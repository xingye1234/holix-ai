import { Context, Duration, Effect, Layer, Ref } from 'effect'
import { logger } from './logger'

// ===== Phase Types =====

export enum LifecyclePhase {
  INITIALIZING = 'initializing',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error',
}

// ===== Typed Errors =====

export class TaskFailed {
  readonly _tag = 'TaskFailed'
  constructor(
    readonly taskName: string,
    readonly phase: LifecyclePhase,
    readonly cause: unknown,
  ) {}
}

export class TaskTimedOut {
  readonly _tag = 'TaskTimedOut'
  constructor(
    readonly taskName: string,
    readonly timeoutMs: number,
  ) {}
}

// ===== Metrics & Report Types =====

export interface TaskMetric {
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

// ===== Task Interface =====

export interface LifecycleTask {
  name: string
  execute: () => Effect.Effect<any, any, never>
  timeout?: Duration.DurationInput
}

export type LifecycleHook = (phase: LifecyclePhase) => void | Promise<void>

// ===== Service Interface =====

export interface LifecycleService {
  executeTask: (task: LifecycleTask) => Effect.Effect<void, TaskFailed, never>
  executeTasks: (tasks: LifecycleTask[]) => Effect.Effect<void, TaskFailed, never>
  setPhase: (phase: LifecyclePhase) => Effect.Effect<void, never, never>
  getPhase: () => Effect.Effect<LifecyclePhase, never, never>
  onPhase: (phase: LifecyclePhase, hook: LifecycleHook) => Effect.Effect<void, never, never>
  getPerformanceReport: () => Effect.Effect<PerformanceReport, never, never>
  printPerformanceReport: () => Effect.Effect<void, never, never>
  printPerformanceSummary: () => Effect.Effect<void, never, never>
}

export const LifecycleTag = Context.GenericTag<LifecycleService>('LifecycleService')

// ===== Implementation =====

function makeLifecycleService(
  phaseRef: Ref.Ref<LifecyclePhase>,
  metricsRef: Ref.Ref<TaskMetric[]>,
  hooksRef: Ref.Ref<Map<LifecyclePhase, LifecycleHook[]>>,
  startupTime: number,
): LifecycleService {
  const logPhaseChange = (p: LifecyclePhase) => {
    const elapsed = Date.now() - startupTime
    logger.info(`[Lifecycle] ═══════════════════════════════════════════`)
    logger.info(`[Lifecycle] Phase: ${p.toUpperCase()} (+${elapsed}ms)`)
    logger.info(`[Lifecycle] ═══════════════════════════════════════════`)
  }

  // --- 内部实现函数，避免 this 绑定问题 ---

  function executeTask(task: LifecycleTask): Effect.Effect<void, TaskFailed> {
    return Effect.gen(function* () {
      const startTime = performance.now()
      const currentPhase = yield* Ref.get(phaseRef)

      logger.info(`[Lifecycle] Executing task: ${task.name}`)

      // Effect.timeout 在 v3 中：成功返回原始值，超时则 fail with TimeoutException
      const program = task.timeout
        ? task.execute().pipe(Effect.timeout(Duration.decode(task.timeout)))
        : task.execute()

      const result = yield* Effect.either(program)

      const endTime = performance.now()
      const duration = endTime - startTime

      if (result._tag === 'Right') {
        // 成功
        const metric: TaskMetric = {
          taskName: task.name,
          phase: currentPhase,
          startTime,
          endTime,
          duration,
          success: true,
        }
        logger.info(`[Lifecycle] ✓ Task completed: ${task.name} (${duration.toFixed(2)}ms)`)
        yield* Ref.update(metricsRef, m => [...m, metric])
      }
      else {
        const error = result.left
        // 检查是否为超时（Effect.timeout 超时时 fail with TimeoutException）
        const isTimeout = error !== null
          && typeof error === 'object'
          && '_tag' in (error as object)
          && (error as { _tag: string })._tag === 'TimeoutException'

        if (isTimeout && task.timeout) {
          const timeoutMs = Duration.toMillis(Duration.decode(task.timeout))
          const metric: TaskMetric = {
            taskName: task.name,
            phase: currentPhase,
            startTime,
            endTime,
            duration,
            success: false,
            error: new Error(`Timed out after ${timeoutMs}ms`),
          }
          logger.error(`[Lifecycle] ✗ Task timed out: ${task.name} (${timeoutMs}ms)`)
          yield* Ref.update(metricsRef, m => [...m, metric])
          yield* Effect.fail(new TaskFailed(task.name, currentPhase, new TaskTimedOut(task.name, timeoutMs)))
        }
        else {
          // 普通失败
          const metric: TaskMetric = {
            taskName: task.name,
            phase: currentPhase,
            startTime,
            endTime,
            duration,
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
          }
          logger.error(`[Lifecycle] ✗ Task failed: ${task.name} (${duration.toFixed(2)}ms)`, error)
          yield* Ref.update(metricsRef, m => [...m, metric])
          yield* Effect.fail(new TaskFailed(task.name, currentPhase, error))
        }
      }
    })
  }

  function executeTasks(tasks: LifecycleTask[]): Effect.Effect<void, TaskFailed> {
    return Effect.forEach(tasks, task => executeTask(task), { discard: true }) as Effect.Effect<void, TaskFailed>
  }

  function setPhase(phase: LifecyclePhase): Effect.Effect<void> {
    return Effect.gen(function* () {
      const current = yield* Ref.get(phaseRef)
      if (current === phase)
        return

      logPhaseChange(phase)
      yield* Ref.set(phaseRef, phase)

      const hookMap = yield* Ref.get(hooksRef)
      const hooks = hookMap.get(phase)
      if (hooks) {
        for (const hook of hooks) {
          try {
            yield* Effect.promise(() => Promise.resolve(hook(phase)))
          }
          catch (error) {
            logger.error(`[Lifecycle] Hook failed for phase ${phase}:`, error)
          }
        }
      }
    })
  }

  function getPhase(): Effect.Effect<LifecyclePhase> {
    return Ref.get(phaseRef)
  }

  function onPhase(phase: LifecyclePhase, hook: LifecycleHook): Effect.Effect<void> {
    return Ref.update(hooksRef, (map) => {
      const newMap = new Map(map)
      const hooks = newMap.get(phase) ?? []
      newMap.set(phase, [...hooks, hook])
      return newMap
    })
  }

  function getPerformanceReport(): Effect.Effect<PerformanceReport> {
    return Effect.gen(function* () {
      const allMetrics = yield* Ref.get(metricsRef)
      const currentPhase = yield* Ref.get(phaseRef)
      const totalDuration = Date.now() - startupTime
      const successTasks = allMetrics.filter(m => m.success).length
      const failedTasks = allMetrics.filter(m => !m.success).length

      // Group by phase
      const byPhase = new Map<LifecyclePhase, TaskMetric[]>()
      for (const metric of allMetrics) {
        if (!byPhase.has(metric.phase)) {
          byPhase.set(metric.phase, [])
        }
        byPhase.get(metric.phase)!.push(metric)
      }

      const tasksByPhase: PerformanceReport['tasksByPhase'] = {}
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

      const slowTasks = allMetrics
        .filter(m => m.duration > 100)
        .map(m => ({
          name: m.taskName,
          phase: m.phase,
          duration: Number(m.duration.toFixed(2)),
        }))

      const allTasks = allMetrics.map(m => ({
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
          currentPhase,
          totalTasks: allMetrics.length,
          successfulTasks: successTasks,
          failedTasks,
          startTime: startupTime,
          endTime: Date.now(),
        },
        tasksByPhase,
        slowTasks,
        allTasks,
      }
    })
  }

  function printPerformanceReport(): Effect.Effect<void> {
    return Effect.gen(function* () {
      const report = yield* getPerformanceReport()
      logger.info('[Lifecycle] Performance Report:')
      logger.info(JSON.stringify(report, null, 2))
    })
  }

  function printPerformanceSummary(): Effect.Effect<void> {
    return Effect.gen(function* () {
      const report = yield* getPerformanceReport()
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
    })
  }

  // 返回服务对象（所有方法通过闭包引用，不依赖 this）
  return {
    executeTask,
    executeTasks,
    setPhase,
    getPhase,
    onPhase,
    getPerformanceReport,
    printPerformanceReport,
    printPerformanceSummary,
  }
}

// ===== Layer =====

export const LifecycleLayer = Layer.effect(
  LifecycleTag,
  Effect.gen(function* () {
    const phase = yield* Ref.make(LifecyclePhase.INITIALIZING)
    const metrics = yield* Ref.make<TaskMetric[]>([])
    const hooks = yield* Ref.make<Map<LifecyclePhase, LifecycleHook[]>>(new Map())
    const startupTime = Date.now()

    logger.info('[Lifecycle] ═══════════════════════════════════════════')
    logger.info('[Lifecycle] Phase: INITIALIZING (+0ms)')
    logger.info('[Lifecycle] ═══════════════════════════════════════════')

    return makeLifecycleService(phase, metrics, hooks, startupTime)
  }),
)
