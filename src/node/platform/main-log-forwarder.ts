import type { MainLogEntry } from '@/types/updates/main-log'
import { format } from 'node:util'
import { update } from './update'

type LoggerLike = Record<string, unknown>
type MainLogLevel = MainLogEntry['level']

const LOG_LEVELS: MainLogLevel[] = ['error', 'warn', 'info', 'verbose', 'debug', 'silly']
const PATCH_FLAG = '__main_log_forwarder_patched__'

let rendererReady = false
const prebookLogs: MainLogEntry[] = []

function buildLine(level: MainLogLevel, timestamp: number, text: string) {
  const date = new Date(timestamp)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const i = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  const ms = String(date.getMilliseconds()).padStart(3, '0')
  return `[${y}-${m}-${d} ${h}:${i}:${s}.${ms}] [${level}] ${text}`
}

function pushLog(level: MainLogLevel, args: unknown[]) {
  const timestamp = Date.now()
  const text = format(...args)
  const item: MainLogEntry = {
    level,
    timestamp,
    line: buildLine(level, timestamp, text),
  }

  if (rendererReady) {
    update('main-process.logs', { logs: [item] })
    return
  }

  prebookLogs.push(item)
}

export function setupMainLogForwarder(logger: LoggerLike) {
  if (logger[PATCH_FLAG])
    return

  for (const level of LOG_LEVELS) {
    const original = logger[level]
    if (typeof original !== 'function')
      continue

    logger[level] = (...args: unknown[]) => {
      pushLog(level, args)
      return original(...args)
    }
  }

  logger[PATCH_FLAG] = true
}

export function markMainLogRendererReady() {
  if (rendererReady)
    return

  rendererReady = true

  if (prebookLogs.length > 0) {
    update('main-process.logs', { logs: prebookLogs.slice() })
    prebookLogs.length = 0
  }
}
