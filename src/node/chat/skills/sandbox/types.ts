/**
 * 沙箱权限类型定义
 */

/**
 * JS skill 的沙箱权限配置
 *
 * 在 skill.json 的 tool 声明中配置：
 * ```json
 * {
 *   "type": "js",
 *   "file": "tools.js",
 *   "permissions": {
 *     "allowedBuiltins": ["path", "crypto"],
 *     "allowedEnvKeys": ["MY_API_KEY"],
 *     "timeout": 15000
 *   }
 * }
 * ```
 */
export interface SandboxPermissions {
  /**
   * 允许 require() 的 Node.js 内置模块白名单。
   *
   * 默认：空（不允许任何 require）
   *
   * 安全等级：
   *   🟢 低风险：path, url, util, crypto, os, buffer, events, querystring
   *   🟡 中风险：fs, net, http, https, dgram, dns, stream
   *   🔴 高风险：child_process, worker_threads, cluster
   *
   * 以下模块永远禁止，即使声明了也无效：
   *   electron, better-sqlite3, 以及所有以 electron/ 开头的路径
   */
  allowedBuiltins?: string[]

  /**
   * 允许读取的 process.env key 白名单。
   *
   * 默认：空（沙箱进程看不到任何环境变量）
   * 示例：["API_KEY", "BASE_URL"]
   */
  allowedEnvKeys?: string[]

  /**
   * JS 执行超时（毫秒）。
   *
   * 默认：10000（10秒）
   * 超时后 Worker 线程自动终止。
   */
  timeout?: number

  /**
   * Worker 线程最大堆内存（MB）。
   *
   * 默认：64 MB
   */
  maxMemoryMb?: number
}

/** 默认沙箱权限（最严格模式） */
export const DEFAULT_PERMISSIONS: Required<SandboxPermissions> = {
  allowedBuiltins: [],
  allowedEnvKeys: [],
  timeout: 10_000,
  maxMemoryMb: 64,
}

/**
 * 永远禁止的模块，无论 allowedBuiltins 如何配置
 *
 * electron 相关：防止技能访问主进程 API（BrowserWindow、ipcMain、app 等）
 * 数据库相关：防止技能直接读写应用数据库
 */
export const HARDCODED_BLOCKED: readonly string[] = [
  'electron',
  'electron/main',
  'electron/renderer',
  'electron/common',
  'better-sqlite3',
  '@libsql/client',
] as const

/** 分类：安全/可选开放的 Node.js 内置模块 */
export const SAFE_BUILTINS: readonly string[] = [
  // 🟢 低风险
  'path',
  'node:path',
  'url',
  'node:url',
  'util',
  'node:util',
  'crypto',
  'node:crypto',
  'os',
  'node:os',
  'buffer',
  'node:buffer',
  'events',
  'node:events',
  'querystring',
  'node:querystring',
  'string_decoder',
  'node:string_decoder',
  'punycode',
  'node:punycode',
  'assert',
  'node:assert',
  // 🟡 中风险（需显式声明）
  'fs',
  'node:fs',
  'fs/promises',
  'node:fs/promises',
  'stream',
  'node:stream',
  'stream/promises',
  'node:stream/promises',
  'net',
  'node:net',
  'http',
  'node:http',
  'https',
  'node:https',
  'dgram',
  'node:dgram',
  'dns',
  'node:dns',
  'dns/promises',
  'node:dns/promises',
  'zlib',
  'node:zlib',
  'readline',
  'node:readline',
  'timers',
  'node:timers',
  'timers/promises',
  'node:timers/promises',
  // 🔴 高风险（谨慎开放）
  'child_process',
  'node:child_process',
  'worker_threads',
  'node:worker_threads',
  'cluster',
  'node:cluster',
  'module',
  'node:module',
  'vm',
  'node:vm',
  'v8',
  'node:v8',
  'perf_hooks',
  'node:perf_hooks',
  'tls',
  'node:tls',
  'http2',
  'node:http2',
] as const
