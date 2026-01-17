import type { Chat } from '@/node/database/schema/chat'
import { createContext, useContext } from 'react'

/**
 * Chat Context 类型定义
 */
export interface ChatContextValue {
  /** 当前聊天信息 */
  chat: Chat | null
  /** 聊天 ID */
  chatId: string
}

/**
 * Chat Context
 */
export const ChatContext = createContext<ChatContextValue | null>(null)

/**
 * 使用 Chat Context Hook
 * @returns ChatContextValue
 * @throws 如果在 ChatContext.Provider 外部使用会抛出错误
 */
export function useChatContext() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChatContext must be used within ChatContext.Provider')
  }
  return context
}
