import { logger } from './logger'

export enum LifecyclePhase {
  INITIALIZING = 'initializing',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error',
}

export interface LifecycleTask {
  name: string
  execute: () => Promise<void> | void
  critical?: boolean // 如果失败是否应该终止应用
  timeout?: number // 任务超时时间（毫秒）
}

export interface LifecycleMetrics {
  taskName: string
  phase: LifecyclePhase
  startTime: number
  endTime: number
  duration: number
  success: boolean
  error?: Error
}

export interface PerformanceReport {
  summary: {
    totalStartupTime: number
    currentPhase: LifecyclePhase
    totalTasks: number
    successfulTasks: number
    failedTasks: number
    startTime: number
    endTime: number
  }
  tasksByPhase: Record<string, {
    tasks: Array<{
      name: string
      duration: number
      success: boolean
      error?: string
    }>
    totalDuration: number
    taskCount: number
  }>
  slowTasks: Array<{
    name: string
    phase: string
    duration: number
  }>
  allTasks: Array<{
    name: string
    phase: string
    startTime: number
    endTime: number
    duration: number
    success: boolean
    error?: string
  }>
}

export type LifecycleHook = (phase: LifecyclePhase) => void | Promise<void>

export class AppLifecycle {
  private currentPhase: LifecyclePhase = LifecyclePhase.INITIALIZING
  private metrics: LifecycleMetrics[] = []
  private hooks: Map<LifecyclePhase, LifecycleHook[]> = new Map()
  private startupTime: number = Date.now()

  constructor() {
    this.logPhaseChange(LifecyclePhase.INITIALIZING)
  }

  /**
   * 注册生命周期钩子
   */
  onPhase(phase: LifecyclePhase, hook: LifecycleHook): void {
    if (!this.hooks.has(phase)) {
      this.hooks.set(phase, [])
    }
    this.hooks.get(phase)!.push(hook)
  }

  /**
   * 执行单个任务并收集性能指标
   */
  async executeTask(task: LifecycleTask): Promise<void> {
    const startTime = performance.now()
    const metric: LifecycleMetrics = {
      taskName: task.name,
      phase: this.currentPhase,
      startTime,
      endTime: 0,
      duration: 0,
      success: false,
    }

    logger.info(`[Lifecycle] Executing task: ${task.name}`)

    try {
      if (task.timeout) {
        await this.executeWithTimeout(task.execute, task.timeout, task.name)
      }
      else {
        await task.execute()
      }

      metric.success = true
      const endTime = performance.now()
      metric.endTime = endTime
      metric.duration = endTime - startTime

      logger.info(
        `[Lifecycle] ✓ Task completed: ${task.name} (${metric.duration.toFixed(2)}ms)`,
      )
    }
    catch (error) {
      metric.success = false
      metric.error = error as Error
      metric.endTime = performance.now()
      metric.duration = metric.endTime - startTime

      logger.error(
        `[Lifecycle] ✗ Task failed: ${task.name} (${metric.duration.toFixed(2)}ms)`,
        error,
      )

      if (task.critical !== false) {
        this.setPhase(LifecyclePhase.ERROR)
        throw error
      }
    }
    finally {
      this.metrics.push(metric)
    }
  }

  /**
   * 执行一组任务
   */
  async executeTasks(tasks: LifecycleTask[]): Promise<void> {
    for (const task of tasks) {
      await this.executeTask(task)
    }
  }

  /**
   * 带超时的任务执行
   */
  private async executeWithTimeout(
    fn: () => Promise<void> | void,
    timeout: number,
    taskName: string,
  ): Promise<void> {
    return Promise.race([
      Promise.resolve(fn()),
      new Promise<void>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Task "${taskName}" timed out after ${timeout}ms`)),
          timeout,
        ),
      ),
    ])
  }

  /**
   * 设置当前阶段
   */
  async setPhase(phase: LifecyclePhase): Promise<void> {
    if (this.currentPhase === phase)
      return

    this.logPhaseChange(phase)
    this.currentPhase = phase

    // 执行注册的钩子
    const hooks = this.hooks.get(phase)
    if (hooks) {
      for (const hook of hooks) {
        try {
          await hook(phase)
        }
        catch (error) {
          logger.error(`[Lifecycle] Hook failed for phase ${phase}:`, error)
        }
      }
    }
  }

  /**
   * 获取当前阶段
   */
  getPhase(): LifecyclePhase {
    return this.currentPhase
  }

  /**
   * 记录阶段变化
   */
  private logPhaseChange(phase: LifecyclePhase): void {
    const elapsed = Date.now() - this.startupTime
    logger.info(
      `[Lifecycle] ═══════════════════════════════════════════`,
    )
    logger.info(
      `[Lifecycle] Phase: ${phase.toUpperCase()} (+${elapsed}ms)`,
    )
    logger.info(
      `[Lifecycle] ═══════════════════════════════════════════`,
    )
  }

  /**
   * 获取性能报告（JSON 格式）
   */
  getPerformanceReport(): PerformanceReport {
    const totalDuration = Date.now() - this.startupTime
    const successTasks = this.metrics.filter(m => m.success).length
    const failedTasks = this.metrics.filter(m => !m.success).length

    // 按阶段分组
    const byPhase = new Map<LifecyclePhase, LifecycleMetrics[]>()
    for (const metric of this.metrics) {
      if (!byPhase.has(metric.phase)) {
        byPhase.set(metric.phase, [])
      }
      byPhase.get(metric.phase)!.push(metric)
    }

    // 构建按阶段分组的任务数据
    const tasksByPhase: Record<string, any> = {}
    for (const [phase, metrics] of byPhase) {
      const tasks = metrics.map(m => ({
        name: m.taskName,
        duration: Number(m.duration.toFixed(2)),
        success: m.success,
        error: m.error?.message,
      }))

      tasksByPhase[phase] = {
        tasks,
        totalDuration: Number(tasks.reduce((sum, t) => sum + t.duration, 0).toFixed(2)),
        taskCount: tasks.length,
      }
    }

    // 获取慢任务
    const slowTasks = this.getSlowTasks(100).map(m => ({
      name: m.taskName,
      phase: m.phase,
      duration: Number(m.duration.toFixed(2)),
    }))

    // 所有任务
    const allTasks = this.metrics.map(m => ({
      name: m.taskName,
      phase: m.phase,
      startTime: m.startTime,
      endTime: m.endTime,
      duration: Number(m.duration.toFixed(2)),
      success: m.success,
      error: m.error?.message,
    }))

    return {
      summary: {
        totalStartupTime: Number(totalDuration.toFixed(2)),
        currentPhase: this.currentPhase,
        totalTasks: this.metrics.length,
        successfulTasks: successTasks,
        failedTasks,
        startTime: this.startupTime,
        endTime: Date.now(),
      },
      tasksByPhase,
      slowTasks,
      allTasks,
    }
  }

  /**
   * 打印性能报告（JSON 格式）
   */
  printPerformanceReport(): void {
    const report = this.getPerformanceReport()
    logger.info('[Lifecycle] Performance Report:')
    logger.info(JSON.stringify(report, null, 2))
  }

  /**
   * 打印性能报告摘要（简洁格式）
   */
  printPerformanceSummary(): void {
    const report = this.getPerformanceReport()
    logger.info('[Lifecycle] ═══════════════════════════════════════════')
    logger.info('[Lifecycle] PERFORMANCE SUMMARY')
    logger.info('[Lifecycle] ═══════════════════════════════════════════')
    logger.info(`[Lifecycle] Total Startup Time: ${report.summary.totalStartupTime}ms`)
    logger.info(`[Lifecycle] Current Phase: ${report.summary.currentPhase}`)
    logger.info(`[Lifecycle] Total Tasks: ${report.summary.totalTasks}`)
    logger.info(`[Lifecycle] Successful: ${report.summary.successfulTasks} | Failed: ${report.summary.failedTasks}`)

    if (report.slowTasks.length > 0) {
      logger.warn(`[Lifecycle] Slow Tasks (>100ms): ${report.slowTasks.length}`)
      for (const task of report.slowTasks) {
        logger.warn(`[Lifecycle]   - ${task.name}: ${task.duration}ms`)
      }
    }

    logger.info('[Lifecycle] ═══════════════════════════════════════════')
  }

  /**
   * 获取所有指标
   */
  getMetrics(): LifecycleMetrics[] {
    return [...this.metrics]
  }

  /**
   * 获取慢任务（超过阈值的任务）
   */
  getSlowTasks(threshold = 100): LifecycleMetrics[] {
    return this.metrics.filter(m => m.duration > threshold)
  }

  /**
   * 重置生命周期
   */
  reset(): void {
    this.currentPhase = LifecyclePhase.INITIALIZING
    this.metrics = []
    this.startupTime = Date.now()
  }
}
