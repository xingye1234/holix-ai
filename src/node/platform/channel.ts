import type { RouteHandler } from '@holix/router'
import { randomUUID } from 'node:crypto'

class ConnectionSender {
  id: string
  connect: ReadableStreamDefaultController
  constructor(
    id: string,
    connect: ReadableStreamDefaultController,
  ) {
    this.id = id
    this.connect = connect
  }

  sendMessage(data: unknown) {
    const message = `data: ${JSON.stringify(data)}\n\n`
    this.enqueue(message)
  }

  enqueue(data: string) {
    this.connect.enqueue(new TextEncoder().encode(data))
  }

  heartbeat() {
    this.enqueue(`: heartbeat\n\n`)
  }
}

const connectionLoop = new Map<string, ConnectionSender>()

export function createChannel() {
  const handle: RouteHandler = async (ctx, next) => {
    const connectionId = randomUUID()
    const stream = new ReadableStream({
      start(controller) {
        const sender = new ConnectionSender(connectionId, controller)
        sender.sendMessage({
          type: 'connected',
          message: '已连接到 SSE 流',
          connectionId,
        })
        connectionLoop.set(connectionId, sender)
        const heartbeat = setInterval(() => {
          try {
            sender.heartbeat()
          }
          catch {
            clearInterval(heartbeat)
            connectionLoop.delete(connectionId)
          }
        }, 15000)
        const cleanup = () => {
          clearInterval(heartbeat)
          connectionLoop.delete(connectionId)
        }

        ctx.req.signal?.addEventListener('abort', cleanup)

        return cleanup
      },
      cancel() {
        connectionLoop.delete(connectionId)
      },
    })

    ctx
      .status(200)
      .headers({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })
      .stream(stream)

    await next()
  }

  return handle
}

/**
 *
 * @param data 需要发送的数据
 */
export function sendChannelMessage<T = unknown>(data: T) {
  for (const [, connection] of connectionLoop) {
    connection.sendMessage(data)
  }
}

export interface ChannelCallbackPayload<T = unknown> {
  id: string
  args: T
}

const CALLBACK_ID_PREFIX = 'callback_'
const waitCallbackResponses = new Map<string, PromiseWithResolvers<any>>()

export function generateChannelCallbackId() {
  return CALLBACK_ID_PREFIX + randomUUID()
}

export async function sendChannelCallback<T>(name: string, ...args: any[]) {
  const promiser = Promise.withResolvers<T>()
  const id = generateChannelCallbackId()

  sendChannelMessage({
    type: 'callback',
    id,
    name,
    args,
  })
  waitCallbackResponses.set(id, promiser)
  promiser.promise.finally(() => {
    waitCallbackResponses.delete(id)
  })
  return await promiser.promise
}
