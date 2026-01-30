import type { Update, UpdateNames } from '@/types/updates'
import type { EventEnvelope } from '@/types/updates/base'
import { AsyncBatcher } from '@tanstack/pacer'
import { nanoid } from 'nanoid'
import { sendChannelMessage } from './channel'
import { logger } from './logger'

// 通用更新事件的批处理器
const batcher = new AsyncBatcher<EventEnvelope>(
  async (items) => {
    sendChannelMessage(items)
  },
  {
    maxSize: 100,
    wait: 100,
    onError: (error, batch) => {
      logger.error('Failed to send update batch:', error, batch)
    },
    asyncRetryerOptions: {
      maxAttempts: 3,
      backoff: 'exponential',
      baseWait: 1000,
      jitter: 0.3,
    },
  },
)

// 流式消息专用批处理器（更激进的实时性配置）
const streamingBatcher = new AsyncBatcher<EventEnvelope>(
  async (items) => {
    sendChannelMessage(items)
  },
  {
    maxSize: 10, // 更小的批次大小，确保及时发送
    wait: 16, // ~60fps 的更新频率，保证流畅感
    onError: (error, batch) => {
      logger.error('Failed to send streaming update batch:', error, batch)
    },
    asyncRetryerOptions: {
      maxAttempts: 2, // 流式更新失败重试次数少一些
      backoff: 'exponential',
      baseWait: 500,
      jitter: 0.2,
    },
  },
)

export function update<N extends UpdateNames>(
  name: N,
  payload: Extract<Update, { name: N }>['payload'],
): void {
  const envelope: EventEnvelope = {
    id: nanoid(),
    timestamp: Date.now(),
    type: 'update',
    name,
    payload,
  }

  // 流式消息使用专用的 batcher，其他使用通用 batcher
  if (name === 'message.streaming') {
    streamingBatcher.addItem(envelope)
  }
  else {
    batcher.addItem(envelope)
  }
}

export async function updateAwait<T>(name: string, ...args: any[]) {
  const promiser = Promise.withResolvers<T>()
  const id = nanoid()

  return await promiser.promise
}
