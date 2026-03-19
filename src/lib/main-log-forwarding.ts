import { onUpdate } from './command'

const levelToMethod: Record<string, 'error' | 'warn' | 'info' | 'debug' | 'log'> = {
  error: 'error',
  warn: 'warn',
  info: 'info',
  verbose: 'info',
  debug: 'debug',
  silly: 'log',
}

const consoleRef = globalThis.console

let started = false

export function startMainLogForwarding() {
  if (started)
    return

  started = true

  onUpdate('main-process.logs', (payload) => {
    for (const log of payload.logs) {
      const method = levelToMethod[log.level] ?? 'log'
      consoleRef[method](log.line)
    }
  })
}
