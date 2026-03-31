/**
 * 会话状态类型定义
 */

import type { SystemMessage } from '@langchain/core/messages'
import type { Workspace } from '../../database/schema/chat'

/**
 * 会话状态
 */
export type SessionStatus = 'running' | 'completed' | 'aborted' | 'error'

/**
 * 会话模型配置
 */
export interface SessionModelConfig {
  /** Provider 类型，例如 openai / anthropic / gemini */
  provider: string

  /** 模型名称 */
  model: string

  /** Provider API Key */
  apiKey?: string

  /** Provider Base URL（OpenAI 兼容 / 自定义网关） */
  baseURL?: string
}

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

  /** 模型配置 */
  modelConfig: SessionModelConfig

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
