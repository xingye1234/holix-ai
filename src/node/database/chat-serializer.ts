/**
 * Chat 数据序列化/反序列化
 * 处理数据库层的 JSON 字段转换，避免业务代码侵入
 */

import type { Chat, ChatContextSettings, PendingMessage, Workspace } from './schema/chat'
import { DEFAULT_CHAT_CONTEXT_SETTINGS } from './schema/chat'

/**
 * 数据库原始 Chat 类型（JSON 字段为字符串）
 */
export type RawChat = Omit<Chat, 'prompts' | 'workspace' | 'pendingMessages' | 'contextSettings'> & {
  prompts: string | string[]
  workspace: string | Workspace[] | null
  pendingMessages: string | PendingMessage[] | null
  contextSettings: string | ChatContextSettings
}

/**
 * 反序列化 Chat 对象
 * 将数据库中的 JSON 字符串字段转换为对象
 */
export function deserializeChat(raw: RawChat): Chat {
  return {
    ...raw,
    prompts: deserializeJsonField(raw.prompts, []) as string[],
    workspace: deserializeJsonField(raw.workspace, null) as Workspace[] | null,
    pendingMessages: deserializeJsonField(raw.pendingMessages, null) as PendingMessage[] | null,
    contextSettings: deserializeJsonField(raw.contextSettings, DEFAULT_CHAT_CONTEXT_SETTINGS) as ChatContextSettings,
  }
}

/**
 * 序列化 Chat 对象
 * 将对象字段转换为 JSON 字符串用于存储
 */
export function serializeChat<T extends Partial<Chat>>(chat: T): T {
  const result: any = { ...chat }

  if ('prompts' in chat && chat.prompts !== undefined) {
    result.prompts = serializeJsonField(chat.prompts)
  }

  if ('workspace' in chat && chat.workspace !== undefined) {
    result.workspace = serializeJsonField(chat.workspace)
  }

  if ('pendingMessages' in chat && chat.pendingMessages !== undefined) {
    result.pendingMessages = serializeJsonField(chat.pendingMessages)
  }

  if ('contextSettings' in chat && chat.contextSettings !== undefined) {
    result.contextSettings = serializeJsonField(chat.contextSettings)
  }

  return result
}

/**
 * 反序列化 JSON 字段
 * 如果已经是对象则直接返回，如果是字符串则解析
 */
function deserializeJsonField<T>(value: string | T | null | undefined, defaultValue: T): T {
  if (value === null || value === undefined) {
    return defaultValue
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    }
    catch {
      return defaultValue
    }
  }

  return value as T
}

/**
 * 序列化 JSON 字段
 * 将对象转换为 JSON 字符串
 */
function serializeJsonField<T>(value: T | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null
  }

  return JSON.stringify(value)
}
