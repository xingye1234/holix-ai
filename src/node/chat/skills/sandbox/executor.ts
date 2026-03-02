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
import { DEFAULT_PERMISSIONS, HARDCODED_BLOCKED, SAFE_BUILTINS } from './types'

// ─── Worker 脚本（字符串内嵌，避免打包后路径问题）────────────────────────────

/**
 * 在 Worker 线程内运行的脚本——纯 CommonJS。
 *
 * 接收 workerData：
 *   filePath       技能文件的绝对路径
 *   toolName       要调用的 tool.name
 *   exportName     导出名称（'default' 或具名导出）
 *   args           传递给 execute() 的参数对象
 *   allowedBuiltins 允许 require 的模块名列表
 *   allowedEnvKeys  允许读取的 env key 列表
 *   hardcodedBlocked 永远禁止的模块名列表
 *   safeBuiltins     所有合法的 Node 内置模块列表
 */
const WORKER_SCRIPT = /* js */ `
'use strict';

const { workerData, parentPort } = require('worker_threads');
const vm = require('vm');
const fs = require('fs');
const nodePath = require('path');

const {
  filePath,
  toolName,
  exportName,
  args,
  allowedBuiltins = [],
  allowedEnvKeys = [],
  hardcodedBlocked = [],
  safeBuiltins = [],
} = workerData;

// ─── 沙箱 require ─────────────────────────────────────────────────────────────

function createSandboxedRequire(allowed) {
  const blockedSet = new Set(hardcodedBlocked);
  const safeSet = new Set(safeBuiltins);
  const allowedSet = new Set(allowed);

  return function sandboxedRequire(moduleName) {
    // 1. 硬编码禁止：electron / 数据库模块
    const normalizedName = moduleName.replace(/^node:/, '');
    if (
      blockedSet.has(moduleName) ||
      blockedSet.has(normalizedName) ||
      moduleName === 'electron' ||
      moduleName.startsWith('electron/')
    ) {
      throw new Error(
        '[Skill Sandbox] require("' + moduleName + '") is permanently blocked. ' +
        'Electron and database APIs are not accessible from skill scripts.'
      );
    }

    // 2. 禁止相对路径 / 绝对路径 require（防止加载任意文件）
    if (
      moduleName.startsWith('.') ||
      moduleName.startsWith('/') ||
      /^[A-Za-z]:[\\\\/]/.test(moduleName)
    ) {
      throw new Error(
        '[Skill Sandbox] require("' + moduleName + '") is blocked. ' +
        'Path-based require is not allowed in skill scripts.'
      );
    }

    // 3. 非 Node 内置模块一律禁止（防止加载 npm 包）
    const baseNameForCheck = moduleName.startsWith('node:') ? moduleName : moduleName.split('/')[0];
    if (!safeSet.has(moduleName) && !safeSet.has('node:' + moduleName)) {
      throw new Error(
        '[Skill Sandbox] require("' + moduleName + '") is blocked. ' +
        'Only Node.js built-in modules may be requested.'
      );
    }

    // 4. 白名单检查
    if (!allowedSet.has(moduleName) && !allowedSet.has('node:' + moduleName) && !allowedSet.has(baseNameForCheck)) {
      throw new Error(
        '[Skill Sandbox] require("' + moduleName + '") is not allowed by skill permissions. ' +
        'Allowed modules: ' + (allowed.length ? allowed.join(', ') : '(none)') + '. ' +
        'Add it to the "permissions.allowedBuiltins" array in skill.json.'
      );
    }

    return require(moduleName);
  };
}

// ─── 沙箱 process ─────────────────────────────────────────────────────────────

function createSandboxedProcess(envKeys) {
  const env = Object.create(null);
  for (const key of envKeys) {
    if (process.env[key] !== undefined) {
      env[key] = process.env[key];
    }
  }
  return Object.freeze({
    env,
    platform: process.platform,
    arch: process.arch,
    version: process.version,
    versions: Object.freeze({ node: process.versions.node }),
  });
}

// ─── 主逻辑 ───────────────────────────────────────────────────────────────────

(async function run() {
  try {
    let code;
    try {
      code = fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
      parentPort.postMessage({ ok: false, error: 'Cannot read skill file: ' + e.message });
      return;
    }

    const sandboxedRequire = createSandboxedRequire(allowedBuiltins);
    const sandboxedProcess = createSandboxedProcess(allowedEnvKeys);

    // 构建沙箱上下文——仅暴露安全、不可变的全局值
    const moduleExports = {};
    const moduleObj = { exports: moduleExports };

    const sandboxConsole = {
      log:   (...a) => parentPort.postMessage({ type: 'log', level: 'info',  args: a.map(x => typeof x === 'string' ? x : JSON.stringify(x)) }),
      info:  (...a) => parentPort.postMessage({ type: 'log', level: 'info',  args: a.map(x => typeof x === 'string' ? x : JSON.stringify(x)) }),
      warn:  (...a) => parentPort.postMessage({ type: 'log', level: 'warn',  args: a.map(x => typeof x === 'string' ? x : JSON.stringify(x)) }),
      error: (...a) => parentPort.postMessage({ type: 'log', level: 'error', args: a.map(x => typeof x === 'string' ? x : JSON.stringify(x)) }),
      debug: (...a) => parentPort.postMessage({ type: 'log', level: 'debug', args: a.map(x => typeof x === 'string' ? x : JSON.stringify(x)) }),
    };

    const context = vm.createContext({
      // CJS 模块系统
      module: moduleObj,
      exports: moduleExports,
      require: sandboxedRequire,
      __filename: filePath,
      __dirname: nodePath.dirname(filePath),

      // 安全全局
      process: sandboxedProcess,
      console: sandboxConsole,

      // JS 内置
      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      Error,
      TypeError,
      RangeError,
      SyntaxError,
      ReferenceError,
      URIError,
      EvalError,
      Promise,
      Map,
      Set,
      WeakMap,
      WeakSet,
      Symbol,
      Proxy,
      Reflect,
      BigInt,
      Int8Array, Uint8Array, Uint8ClampedArray,
      Int16Array, Uint16Array,
      Int32Array, Uint32Array,
      Float32Array, Float64Array,
      BigInt64Array, BigUint64Array,
      ArrayBuffer, SharedArrayBuffer,
      DataView,
      Atomics,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      encodeURIComponent,
      decodeURIComponent,
      encodeURI,
      decodeURI,
      URL,
      URLSearchParams,
      TextEncoder,
      TextDecoder,
      structuredClone,
      queueMicrotask,
      clearTimeout: undefined,
      clearInterval: undefined,
      setTimeout: undefined,
      setInterval: undefined,
      setImmediate: undefined,
      // Buffer 按白名单决定
      Buffer: allowedBuiltins.includes('buffer') || allowedBuiltins.includes('node:buffer') ? Buffer : undefined,
    });

    // 执行模块代码（加载阶段），设置较短超时防止顶层无限循环
    vm.runInContext(code, context, {
      filename: filePath,
      timeout: 5000,
      breakOnSigint: true,
    });

    // 取出导出
    const mod = moduleObj.exports;
    const target =
      exportName === 'default'
        ? (mod && mod.default != null ? mod.default : mod)
        : (mod ? mod[exportName] : undefined);

    if (!target) {
      const keys = mod ? Object.keys(mod).join(', ') : '(empty)';
      parentPort.postMessage({
        ok: false,
        error: 'Export "' + exportName + '" not found in ' + filePath + '. Available exports: ' + keys,
      });
      return;
    }

    const definitions = Array.isArray(target) ? target : [target];
    const def = definitions.find(d => d && d.name === toolName);

    if (!def) {
      const names = definitions.map(d => d && d.name).filter(Boolean).join(', ');
      parentPort.postMessage({
        ok: false,
        error: 'Tool "' + toolName + '" not found. Available tools in file: ' + (names || '(none)'),
      });
      return;
    }

    if (typeof def.execute !== 'function') {
      parentPort.postMessage({
        ok: false,
        error: 'Tool "' + toolName + '" has no execute() function.',
      });
      return;
    }

    // 执行 tool
    const result = await def.execute(args);
    const serialized = typeof result === 'string' ? result : JSON.stringify(result);
    parentPort.postMessage({ ok: true, result: serialized });
  } catch (err) {
    parentPort.postMessage({
      ok: false,
      error: err && err.message ? err.message : String(err),
    });
  }
})();
`

// ─── Sandbox Executor ─────────────────────────────────────────────────────────

export interface SandboxRunOptions {
  filePath: string
  toolName: string
  exportName: string
  args: Record<string, any>
  permissions: SandboxPermissions
}

/**
 * 在独立 Worker 线程中的 vm 沙箱内执行一次 tool.execute()
 *
 * @returns 序列化后的执行结果字符串
 * @throws 超时 / 沙箱错误 / tool 运行时错误
 */
export function runInSandbox(options: SandboxRunOptions): Promise<string> {
  const permissions: Required<SandboxPermissions> = {
    ...DEFAULT_PERMISSIONS,
    ...options.permissions,
  }

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
