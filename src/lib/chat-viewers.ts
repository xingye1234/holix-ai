import { CHAT_VIEWERS } from './local-storage'

export interface ChatViewport {
  firstVisibleSeq: number
  lastVisibleSeq: number
}

// 获取 一个 chat 当前展示的消息状态 用来回复当前列表位置
export async function getChatViewport(chatId: string) {
  return await CHAT_VIEWERS.get<ChatViewport>(chatId)
}

// 设置 一个 chat 当前展示的消息状态 用来回复当前列表位置
export async function setChatViewport(chatId: string, viewer: ChatViewport) {
  return await CHAT_VIEWERS.set(chatId, viewer)
}
