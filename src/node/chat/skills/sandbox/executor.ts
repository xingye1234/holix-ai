/**
 * SandboxExecutor：使用 worker_threads + vm 双重隔离执行 JS skill tool
 *
 * 安全边界
 * ─────────────────────────────────────────────────────────────────
 * 层 1 - Worker 线程隔离：
 *   - 独立 V8 堆，无法引用主进程的 JavaScript 对象
 *   - resourceLimits 限制最大内存
 *   - 超时后调用 worker.terminate()，强制回收线程
 *
 * 层 2 - vm.runInContext() 上下文隔离：
 *   - 沙箱全局对象不包含 process / require，仅注入受控副本
 *   - 沙箱 require 只允许白名单内的 Node 内置模块
 *   - electron 及数据库模块硬编码拦截，绕不过去
 *   - 沙箱 process 只暴露 platform/arch/version 及指定 env key
 *
 * 通信协议（via parentPort.postMessage）：
 *   { type: 'log', level, args }    ← skill 内 console.xxx 输出
 *   { ok: true, result: string }    ← 执行成功
 *   { ok: false, error: string }    ← 执行失败
 */

import type { SandboxPermissions } from './types'
import { Worker } from 'node:worker_threads'
import { logger } from '../../../platform/logger'
import { HARDCODED_BLOCKED, normalizeSandboxPermissions, SAFE_BUILTINS } from './types'
import WORKER_SCRIPT from './worker.script.ts?script'

// Worker 脚本通过 `?script` 导入：构建阶段将 worker.script.ts 编译为 CommonJS 字符串

// ─── Sandbox Executor ─────────────────────────────────────────────────────────

export interface SandboxRunOptions {
  filePath: string
  toolName: string
  exportName: string
  args: Record<string, any>
  permissions: SandboxPermissions
  /** Skill 用户配置，注入为沙箱全局 `skillConfig` 对象 */
  skillConfig?: Record<string, unknown>
}

/**
 * 在独立 Worker 线程中的 vm 沙箱内执行一次 tool.execute()
 *
 * @returns 序列化后的执行结果字符串
 * @throws 超时 / 沙箱错误 / tool 运行时错误
 */
export function runInSandbox(options: SandboxRunOptions): Promise<string> {
  const permissions = normalizeSandboxPermissions(options.permissions)

  return new Promise((resolve, reject) => {
    let settled = false

    const worker = new Worker(WORKER_SCRIPT, {
      eval: true,
      workerData: {
        filePath: options.filePath,
        toolName: options.toolName,
        exportName: options.exportName,
        args: options.args,
        allowedBuiltins: permissions.allowedBuiltins,
        allowedEnvKeys: permissions.allowedEnvKeys,
        hardcodedBlocked: [...HARDCODED_BLOCKED],
        safeBuiltins: [...SAFE_BUILTINS],
        skillConfig: options.skillConfig ?? {},
      },
      resourceLimits: {
        maxOldGenerationSizeMb: permissions.maxMemoryMb,
        maxYoungGenerationSizeMb: Math.min(16, permissions.maxMemoryMb),
      },
    })

    const done = (fn: () => void) => {
      if (settled)
        return
      settled = true
      // eslint-disable-next-line ts/no-use-before-define
      clearTimeout(timer)
      fn()
      // 允许 Worker 自然退出，不需要强制 terminate（已 settled）
    }

    const timer = setTimeout(() => {
      worker.terminate().catch(() => {})
      if (!settled) {
        settled = true
        reject(new Error(
          `[Skill Sandbox] Tool "${options.toolName}" execution timed out after ${permissions.timeout}ms`,
        ))
      }
    }, permissions.timeout)

    worker.on('message', (msg: any) => {
      if (msg?.type === 'log') {
        // 将沙箱内 console.xxx 转发到 logger（带 skill 前缀）
        const text = `[Skill:${options.toolName}] ${(msg.args as string[]).join(' ')}`
        switch (msg.level) {
          case 'error': logger.error(text)
            break
          case 'warn': logger.warn(text)
            break
          default: logger.info(text)
        }
        return
      }

      done(() => {
        if (msg.ok) {
          resolve(msg.result as string)
        }
        else {
          reject(new Error(msg.error as string))
        }
      })
    })

    worker.on('error', (err) => {
      done(() => reject(err))
    })

    worker.on('exit', (code) => {
      done(() => {
        if (code !== 0) {
          reject(new Error(`[Skill Sandbox] Worker exited with code ${code}`))
        }
      })
    })
  })
}
