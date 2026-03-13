/**
 * 消息类型定义
 */

import type { DraftContent, ToolCallTrace } from '../../database/schema/chat'

/**
 * 消息角色
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'

/**
 * 消息类型
 */
export type MessageKind = 'message' | 'tool_call' | 'tool_result' | 'thinking' | 'partial'

/**
 * 消息状态
 */
export type MessageStatus = 'pending' | 'streaming' | 'done' | 'aborted' | 'error'

/**
 * 内容类型（为多媒体支持做准备）
 */
export type ContentType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'code'

/**
 * 媒体附件（未来支持）
 */
export interface MediaAttachment {
  type: ContentType
  url?: string
  localPath?: string
  base64?: string
  mimeType: string
  metadata?: Record<string, any>
}

/**
 * 消息内容（扩展版，支持多模态）
 */
export interface MessageContent {
  /** 文本内容 */
  text?: string

  /** 媒体附件 */
  attachments?: MediaAttachment[]

  /** 原始内容（向后兼容） */
  raw?: string
}

/**
 * 消息更新事件
 */
export interface MessageUpdateEvent {
  chatUid: string
  messageUid: string
  updates: {
    status?: MessageStatus
    content?: string
    draftContent?: DraftContent
    toolCalls?: ToolCallTrace[]
    error?: string
  }
}

/**
 * 消息流式更新事件
 */
export interface MessageStreamingEvent {
  chatUid: string
  messageUid: string
  content: string
  delta: string
  draftContent: DraftContent
  toolCalls: ToolCallTrace[]
}
