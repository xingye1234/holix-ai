'use strict'

const { workerData, parentPort } = require('node:worker_threads') as {
  workerData: {
    filePath: string
    toolName: string
    exportName: string
    args: Record<string, unknown>
    allowedBuiltins?: string[]
    allowedEnvKeys?: string[]
    hardcodedBlocked?: string[]
    safeBuiltins?: string[]
    skillConfig?: Record<string, unknown>
  }
  parentPort: {
    postMessage: (msg: Record<string, unknown>) => void
  }
}
const vm = require('node:vm') as typeof import('node:vm')
const fs = require('node:fs') as typeof import('node:fs')
const nodePath = require('node:path') as typeof import('node:path')

const {
  filePath,
  toolName,
  exportName,
  args,
  allowedBuiltins = [],
  allowedEnvKeys = [],
  hardcodedBlocked = [],
  safeBuiltins = [],
  skillConfig = {},
} = workerData

function createSandboxedRequire(allowed: string[]) {
  const blockedSet = new Set(hardcodedBlocked)
  const safeSet = new Set(safeBuiltins)
  const allowedSet = new Set(allowed)

  return function sandboxedRequire(moduleName: string) {
    const normalizedName = moduleName.replace(/^node:/, '')
    if (
      blockedSet.has(moduleName)
      || blockedSet.has(normalizedName)
      || moduleName === 'electron'
      || moduleName.startsWith('electron/')
    ) {
      throw new Error(
        `[Skill Sandbox] require("${moduleName}") is permanently blocked. Electron and database APIs are not accessible from skill scripts.`,
      )
    }

    if (
      moduleName.startsWith('.')
      || moduleName.startsWith('/')
      || /^[A-Z]:[\\/]/i.test(moduleName)
    ) {
      throw new Error(
        `[Skill Sandbox] require("${moduleName}") is blocked. Path-based require is not allowed in skill scripts.`,
      )
    }

    const baseNameForCheck = moduleName.startsWith('node:') ? moduleName : moduleName.split('/')[0]
    if (!safeSet.has(moduleName) && !safeSet.has(`node:${moduleName}`)) {
      throw new Error(
        `[Skill Sandbox] require("${moduleName}") is blocked. Only Node.js built-in modules may be requested.`,
      )
    }

    if (!allowedSet.has(moduleName) && !allowedSet.has(`node:${moduleName}`) && !allowedSet.has(baseNameForCheck)) {
      throw new Error(
        `[Skill Sandbox] require("${moduleName}") is not allowed by skill permissions. Allowed modules: ${allowed.length ? allowed.join(', ') : '(none)'}. Add it to the "permissions.allowedBuiltins" array in skill.json.`,
      )
    }

    return require(moduleName)
  }
}

function createSandboxedProcess(envKeys: string[]) {
  const env = Object.create(null)
  for (const key of envKeys) {
    if (process.env[key] !== undefined)
      env[key] = process.env[key]
  }

  return Object.freeze({
    env,
    platform: process.platform,
    arch: process.arch,
    version: process.version,
    versions: Object.freeze({ node: process.versions.node }),
  })
}

;(async function run() {
  try {
    let code: string
    try {
      code = fs.readFileSync(filePath, 'utf-8')
    }
    catch (e: any) {
      parentPort.postMessage({ ok: false, error: `Cannot read skill file: ${e.message}` })
      return
    }

    const sandboxedRequire = createSandboxedRequire(allowedBuiltins)
    const sandboxedProcess = createSandboxedProcess(allowedEnvKeys)

    const moduleExports = {}
    const moduleObj = { exports: moduleExports }

    const toLogArg = (x: unknown) => typeof x === 'string' ? x : JSON.stringify(x)
    const sandboxConsole = {
      log: (...a: unknown[]) => parentPort.postMessage({ type: 'log', level: 'info', args: a.map(toLogArg) }),
      info: (...a: unknown[]) => parentPort.postMessage({ type: 'log', level: 'info', args: a.map(toLogArg) }),
      warn: (...a: unknown[]) => parentPort.postMessage({ type: 'log', level: 'warn', args: a.map(toLogArg) }),
      error: (...a: unknown[]) => parentPort.postMessage({ type: 'log', level: 'error', args: a.map(toLogArg) }),
      debug: (...a: unknown[]) => parentPort.postMessage({ type: 'log', level: 'debug', args: a.map(toLogArg) }),
    }

    const context = vm.createContext({
      module: moduleObj,
      exports: moduleExports,
      require: sandboxedRequire,
      __filename: filePath,
      __dirname: nodePath.dirname(filePath),

      process: sandboxedProcess,
      console: sandboxConsole,
      skillConfig: Object.freeze(Object.assign(Object.create(null), skillConfig)),

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
      Int8Array,
      Uint8Array,
      Uint8ClampedArray,
      Int16Array,
      Uint16Array,
      Int32Array,
      Uint32Array,
      Float32Array,
      Float64Array,
      BigInt64Array,
      BigUint64Array,
      ArrayBuffer,
      SharedArrayBuffer,
      DataView,
      Atomics,
      parseInt: Number.parseInt,
      parseFloat: Number.parseFloat,
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
      Buffer: allowedBuiltins.includes('buffer') || allowedBuiltins.includes('node:buffer') ? Buffer : undefined,
    })

    vm.runInContext(code, context, {
      filename: filePath,
      timeout: 5000,
      breakOnSigint: true,
    })

    const mod = moduleObj.exports as Record<string, any>
    const target = exportName === 'default'
      ? (mod && mod.default != null ? mod.default : mod)
      : (mod ? mod[exportName] : undefined)

    if (!target) {
      const keys = mod ? Object.keys(mod).join(', ') : '(empty)'
      parentPort.postMessage({ ok: false, error: `Export "${exportName}" not found in ${filePath}. Available exports: ${keys}` })
      return
    }

    const definitions = Array.isArray(target) ? target : [target]
    const def = definitions.find(d => d && d.name === toolName)

    if (!def) {
      const names = definitions.map(d => d && d.name).filter(Boolean).join(', ')
      parentPort.postMessage({ ok: false, error: `Tool "${toolName}" not found. Available tools in file: ${names || '(none)'}` })
      return
    }

    if (typeof def.execute !== 'function') {
      parentPort.postMessage({ ok: false, error: `Tool "${toolName}" has no execute() function.` })
      return
    }

    const result = await def.execute(args)
    const serialized = typeof result === 'string' ? result : JSON.stringify(result)
    parentPort.postMessage({ ok: true, result: serialized })
  }
  catch (err: any) {
    parentPort.postMessage({
      ok: false,
      error: err?.message ?? String(err),
    })
  }
})()
