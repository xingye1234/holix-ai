/**
 * 会话状态类型定义
 */

import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { SystemMessage } from '@langchain/core/messages'
import type { Workspace } from '../../database/schema/chat'

/**
 * 会话状态
 */
export type SessionStatus = 'running' | 'completed' | 'aborted' | 'error'

/**
 * 会话配置
 */
export interface SessionConfig {
  /** 会话 UID */
  chatUid: string

  /** 请求 ID */
  requestId: string

  /** 流 ID */
  streamId: string

  /** Assistant 消息 UID */
  assistantMessageUid: string

  /** LLM 模型 */
  llm: BaseChatModel

  /** 系统消息 */
  systemMessages?: SystemMessage[]

  /** 工作区 */
  workspace?: Workspace[]
}

/**
 * 会话状态
 */
export interface SessionState {
  /** 会话配置 */
  config: SessionConfig

  /** 会话状态 */
  status: SessionStatus

  /** 中止控制器 */
  abortController: AbortController

  /** 开始时间 */
  startTime: number

  /** 结束时间 */
  endTime?: number

  /** 错误信息 */
  error?: string
}
