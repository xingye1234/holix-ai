import type { CommandNames } from '@/types/commands'
import type { Command } from '@/types/commands/base'
import type { Update, UpdateNames } from '@/types/updates'
import type { EventEnvelope } from '@/types/updates/base'
import { AsyncBatcher } from '@tanstack/pacer'
import { nanoid } from 'nanoid'
import { kyInstance } from './ky'
import { holixSSE } from './sse'

export type HandlerFor<N extends UpdateNames> = (
  payload: Extract<Update, { name: N }>['payload'],
  command: Extract<Update, { name: N }>,
) => void

const onUpdateMap = new Map<string, Set<HandlerFor<any>>>()
const onHandlers = new Map<string, (...args: any[]) => Promise<any>>()

const batcher = new AsyncBatcher<Command>(
  async (items) => {
    return await kyInstance.post('command', { json: items })
  },
  {
    maxSize: 100,
    wait: 100,
    onError: (error, batch) => {
      console.error('Failed to send command batch:', error, batch)
    },
    asyncRetryerOptions: {
      maxAttempts: 3,
      backoff: 'exponential',
      baseWait: 1000,
      jitter: 0.3,
    },
  },
)

export function command<
  T extends CommandNames,
  D extends Record<string, unknown>,
>(name: T, preload: D) {
  batcher.addItem({
    id: nanoid(),
    timestamp: Date.now(),
    name,
    payload: preload,
  })
}

export function registerCommandHandler(name: string, fn: (...args: any[]) => Promise<any>) {
  onHandlers.set(name, fn)
  return () => {
    onHandlers.delete(name)
  }
}

const commandKeys = new Set<string>([
  'id',
  'timestamp',
  'name',
  'payload',
  'type',
])

holixSSE.on('message', (data: unknown) => {
  if (typeof data === 'object' && Array.isArray(data)) {
    for (const command of data as EventEnvelope[]) {
      if (
        typeof command === 'object'
        && Object.keys(command).every(key => commandKeys.has(key))
      ) {
        if (command.type === 'update') {
          const handlers = onUpdateMap.get(command.name)
          if (handlers) {
            for (const h of handlers) {
              try {
                // first arg: payload, second arg: full command
                h(command.payload, command as Update)
              }
              catch (err) {
                console.error('onUpdate handler error:', err)
              }
            }
          }
        }

        if (command.type === 'callback') {
          const handler = onHandlers.get(command.name)
          if (handler) {
            Promise.resolve(handler(command.payload))
              .then((result) => {
                kyInstance.post('command/response', {
                  json: {
                    id: command.id,
                    result,
                  },
                })
              })
              .catch((err) => {
                kyInstance.post('command/response', {
                  json: {
                    id: command.id,
                    error: err?.message || String(err),
                    result: null,
                  },
                })
              })
          }
        }
      }
    }
  }
})

export function onUpdate<N extends UpdateNames>(
  name: N,
  fn: HandlerFor<N>,
) {
  const key = name as string
  const set = onUpdateMap.get(key) ?? new Set<HandlerFor<N>>()
  set.add(fn as unknown as HandlerFor<N>)
  onUpdateMap.set(key, set)
  return () => {
    set.delete(fn as unknown as HandlerFor<N>)
  }
}
