'use strict'

/**
 * shell — 内置 Shell 命令执行工具集
 *
 * 工具列表：
 *   run_shell_command      在指定目录执行单条 shell 命令
 *   get_environment_info   获取系统环境信息（平台/shell/home 目录等）
 */

const { execFile } = require('node:child_process')
const path = require('node:path')
const os = require('node:os')
const { promisify } = require('node:util')

const execFileAsync = promisify(execFile)

const MAX_OUTPUT = 128 * 1024 // 128 KB 截断上限
const DEFAULT_TIMEOUT = 30_000

// ─── helpers ──────────────────────────────────────────────────────────────────

function truncate(str, limit = MAX_OUTPUT) {
  if (!str) return ''
  if (str.length <= limit) return str
  return str.slice(0, limit) + `\n\n[...输出过长，已截断（共 ${str.length} 字符）]`
}

function resolveCwd(cwd) {
  if (!cwd) return os.homedir()
  const expanded = cwd.replace(/^~/, os.homedir())
  return path.resolve(expanded)
}

const IS_WINDOWS = os.platform() === 'win32'

/**
 * 返回当前平台的 shell 可执行文件及命令参数
 * - Windows: cmd.exe /d /s /c <command>
 * - Unix:    /bin/sh -c <command>（优先用 $SHELL）
 */
function getShellArgs(command) {
  if (IS_WINDOWS) {
    return { shell: 'cmd.exe', args: ['/d', '/s', '/c', command] }
  }
  const sh = process.env.SHELL || '/bin/sh'
  return { shell: sh, args: ['-c', command] }
}

// ─── run_shell_command ────────────────────────────────────────────────────────

const runShellCommand = {
  name: 'run_shell_command',
  description:
    '在指定目录执行一条 shell 命令，返回 stdout / stderr 及退出码。'
    + ' 适用于查看文件内容、运行脚本、构建项目等任务。',
  schema: {
    command: {
      type: 'string',
      description: '要执行的完整 shell 命令（传给 /bin/sh -c）',
    },
    cwd: {
      type: 'string',
      description: '工作目录（绝对路径，Unix 下支持 ~/… 相对主目录）。留空则使用用户主目录。',
      optional: true,
    },
    timeout_ms: {
      type: 'number',
      description: `命令超时毫秒数，默认 ${DEFAULT_TIMEOUT}，最大 120000`,
      optional: true,
    },
  },
  execute: async ({ command, cwd, timeout_ms }) => {
    const workDir = resolveCwd(cwd)
    const timeout = Math.min(Math.max(timeout_ms ?? DEFAULT_TIMEOUT, 1000), 120_000)

    let stdout = ''
    let stderr = ''
    let exitCode = 0

    try {
      const { shell, args } = getShellArgs(command)
      const result = await execFileAsync(shell, args, {
        cwd: workDir,
        timeout,
        maxBuffer: MAX_OUTPUT * 2,
        env: {
          ...process.env,
          TERM: 'dumb',
          NO_COLOR: '1',
        },
      })
      stdout = result.stdout ?? ''
      stderr = result.stderr ?? ''
      exitCode = 0
    }
    catch (err) {
      stdout = err.stdout ?? ''
      stderr = err.stderr ?? ''
      exitCode = err.code ?? 1

      if (err.killed || err.signal === 'SIGTERM') {
        return [
          `命令超时（${timeout}ms）被终止`,
          `工作目录：${workDir}`,
          `命令：${command}`,
        ].join('\n')
      }
    }

    const parts = []
    parts.push(`工作目录：${workDir}`)
    parts.push(`退出码：${exitCode}`)

    const outTrimmed = truncate(stdout.trim())
    const errTrimmed = truncate(stderr.trim())

    if (outTrimmed) parts.push(`\n── stdout ──\n${outTrimmed}`)
    if (errTrimmed) parts.push(`\n── stderr ──\n${errTrimmed}`)
    if (!outTrimmed && !errTrimmed) parts.push('\n（无输出）')

    return parts.join('\n')
  },
}

// ─── get_environment_info ─────────────────────────────────────────────────────

const getEnvironmentInfo = {
  name: 'get_environment_info',
  description:
    '获取当前系统环境的基本信息：操作系统、平台、主目录、默认 shell、CPU 架构等。'
    + ' 适合在执行命令前了解运行环境。',
  schema: {},
  execute: async () => {
    const info = {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      homeDir: os.homedir(),
      tmpDir: os.tmpdir(),
      shell: process.env.SHELL ?? process.env.COMSPEC ?? '（未知）',
      pathEntries: (process.env.PATH ?? '').split(path.delimiter).filter(Boolean),
      nodeVersion: process.version,
    }

    const lines = [
      `平台：${info.platform} (${info.arch}) ${info.release}`,
      `主目录：${info.homeDir}`,
      `临时目录：${info.tmpDir}`,
      `默认 Shell：${info.shell}`,
      `Node 版本：${info.nodeVersion}`,
      `PATH 条目数：${info.pathEntries.length}`,
      `PATH：${info.pathEntries.join('\n      ')}`,
    ]

    return lines.join('\n')
  },
}

// ─── exports ──────────────────────────────────────────────────────────────────

module.exports = [runShellCommand, getEnvironmentInfo]
