/**
 * 流处理状态类型定义
 */

import type { DraftContent } from '../../database/schema/chat'
import type { AsyncBatcher } from '@tanstack/pacer'

/**
 * 工具调用状态
 */
export interface ToolCallStatus {
  /** 是否正在执行工具 */
  running: boolean
  /** 当前执行的工具名称列表 */
  tools: string[]
}

/**
 * 流处理上下文（只读，传递给各个处理器）
 */
export interface StreamContext {
  /** 会话 UID */
  chatUid: string

  /** 请求 ID */
  requestId: string

  /** Assistant 消息 UID */
  assistantMessageUid: string

  /** 节流的数据库更新器 */
  throttledDbUpdate: AsyncBatcher<{ content: string, segments: DraftContent }>
}

/**
 * 流处理状态（可变，各处理器可以修改）
 */
export interface StreamState {
  /** 完整内容 */
  fullContent: string

  /** 片段索引 */
  segmentIndex: number

  /** 草稿片段 */
  draftSegments: DraftContent

  /** 工具调用状态 */
  toolStatus?: {
    running: boolean
    tools: string[]
  }
}

/**
 * 流模式类型
 */
export type StreamMode = 'messages' | 'updates'

/**
 * 消息类型
 */
export type MessageType = 'ai' | 'tool' | 'human' | 'system'

/**
 * 节点类型
 */
export type NodeType = 'agent' | 'tools' | 'unknown'
