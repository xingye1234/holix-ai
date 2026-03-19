import type { EventEnvelope } from './base'

export interface MainLogEntry {
  level: 'error' | 'warn' | 'info' | 'verbose' | 'debug' | 'silly'
  timestamp: number
  line: string
}

export type MainLogEnvelope = EventEnvelope<
  'main-process.logs',
  {
    logs: MainLogEntry[]
  }
>
