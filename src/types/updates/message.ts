/**
 * Message Streaming Update Types
 * 用于实时推送消息流到渲染进程
 */

import type { EventEnvelope } from './base'
import type { DraftSegment, Message } from '@/node/database/schema/chat'

/**
 * 消息创建事件
 */
export type MessageCreatedEnvelope = EventEnvelope<
  'message.created',
  {
    chatUid: string
    message: Message
  }
>

/**
 * 消息流式更新（实时推送内容）
 */
export type MessageStreamingEnvelope = EventEnvelope<
  'message.streaming',
  {
    chatUid: string
    messageUid: string
    content: string // 累积的完整内容
    delta: string // 本次增量内容
    draftContent: DraftSegment[]
    toolCalls: Message['toolCalls']
  }
>

/**
 * 消息更新事件（状态、错误等）
 */
export type MessageUpdatedEnvelope = EventEnvelope<
  'message.updated',
  {
    chatUid: string
    messageUid: string
    updates: Partial<Message>
  }
>

/**
 * 消息流开始
 */
export type MessageStreamStartEnvelope = EventEnvelope<
  'message.stream.start',
  {
    chatUid: string
    messageUid: string
    requestId: string
    model: string
  }
>

/**
 * 消息流增量更新（streaming chunk）
 */
export type MessageStreamChunkEnvelope = EventEnvelope<
  'message.stream.chunk',
  {
    chatUid: string
    messageUid: string
    requestId: string
    segment: DraftSegment
  }
>

/**
 * 消息流完成
 */
export type MessageStreamDoneEnvelope = EventEnvelope<
  'message.stream.done',
  {
    chatUid: string
    messageUid: string
    requestId: string
    finalContent: string
  }
>

/**
 * 消息流错误
 */
export type MessageStreamErrorEnvelope = EventEnvelope<
  'message.stream.error',
  {
    chatUid: string
    messageUid: string
    requestId: string
    error: string
  }
>

export type ChatUpdateEnvelope
  = | MessageCreatedEnvelope
    | MessageStreamingEnvelope
    | MessageUpdatedEnvelope
    | MessageStreamStartEnvelope
    | MessageStreamChunkEnvelope
    | MessageStreamDoneEnvelope
    | MessageStreamErrorEnvelope
