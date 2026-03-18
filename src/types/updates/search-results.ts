import type { Chat, Message } from '@/node/database/schema/chat'

export interface SearchResult {
  messageList: {
    rank: number
    message: Message
  } []
  chatList: {
    rank: number
    chat: Chat
  } []
}
