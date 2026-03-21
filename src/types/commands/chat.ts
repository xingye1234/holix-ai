import type { Command } from './base'

// 发送/追加一条消息到会话（适用于多次交互的每次发言）
export type SendChatMessageCommand = Command<'chat.message', {
  chatId: string
  content: string // 本次消息文本
  replyTo?: string | null // 可选：引用的消息 id
  agent?: string // 可选：使用的 agent 名称
}>

// 结束会话（可用于中止或标记会话完成）
export type EndChatCommand = Command<'chat.end', {
  chatId: string
  messageId: string
}>

// 中止会话的AI回复
export type AbortChatCommand = Command<'chat.abort', {
  requestId?: string // 中止特定请求
  chatId?: string // 中止聊天的所有会话
}>

// 会话相关命令的联合类型（方便 dispatch/handler 使用）
export type ChatCommands
  = SendChatMessageCommand
    | EndChatCommand
    | AbortChatCommand
