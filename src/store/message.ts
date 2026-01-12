import type { Message } from '@/node/database/schema/chat'
import { createWithEqualityFn } from 'zustand/traditional'
import { trpcClient } from '@/lib/trpc-client'

/* ------------------------------------------------------------------ */
/* 类型定义 */
/* ------------------------------------------------------------------ */
interface ChatCache {
  messagesBySeq: Record<number, Message> // 按 seq 缓存
  ranges: Array<{ from: number, to: number }> // 已加载区间
}

interface MessageStore {
  chats: Record<string, ChatCache>

  /* ------------------ 核心方法 ------------------ */
  getRange: (chatUid: string, range?: { from?: number, to?: number }) => Promise<Message[]>
  appendMessage: (chatUid: string, message: Message) => void
  updateMessage: (messageUid: string, updates: Partial<Message>) => void
}

/* ------------------------------------------------------------------ */
/* 消息 Store 实现 */
/* ------------------------------------------------------------------ */
export const useMessageStore = createWithEqualityFn<MessageStore>()((set, get) => {
  // streaming 缓冲，用于合帧更新
  const streamingBuffer = new Map<string, { content: string }>()
  const deltaSubscribers: Record<string, Set<(messages: Message[]) => void>> = {}
  let rafId: number | null = null
  const flushStreaming = () => {
    streamingBuffer.forEach((value, messageUid) => {
      get().updateMessage(messageUid, {
        content: value.content,
        status: 'streaming',
      })
    })
    streamingBuffer.clear()
    rafId = null
  }

  const notifyDelta = (chatUid: string, delta: Message[]) => {
    if (!deltaSubscribers[chatUid])
      return
    deltaSubscribers[chatUid].forEach(cb => cb(delta))
  }

  return {
    chats: {},

    /* ------------------ 消息加载 ------------------ */
    async getRange(chatUid, range) {
      let chatCache = get().chats[chatUid]
      if (!chatCache) {
        chatCache = { messagesBySeq: {}, ranges: [] }
      }

      // range 未传 → 默认拉最新 20 条
      if (!range) {
        const messages = await trpcClient.message.getLatest({ chatUid, limit: 20 })
        messages.forEach(msg => (chatCache!.messagesBySeq[msg.seq] = msg))
        const minSeq = messages[0]?.seq ?? 0
        const maxSeq = messages[messages.length - 1]?.seq ?? 0
        chatCache.ranges.push({ from: minSeq, to: maxSeq })
        set(state => ({ chats: { ...state.chats, [chatUid]: chatCache! } }))
        return messages
      }

      const from = range.from ?? 0
      const to = range.to ?? Number.MAX_SAFE_INTEGER

      // 计算缺失区间
      const missingRanges: { from: number, to: number }[] = []
      let start = from
      while (start <= to) {
        if (!chatCache.messagesBySeq[start]) {
          let end = start
          while (end + 1 <= to && !chatCache.messagesBySeq[end + 1]) end++
          missingRanges.push({ from: start, to: end })
          start = end + 1
        }
        else {
          start++
        }
      }

      // 拉取缺失区间
      for (const r of missingRanges) {
        const msgs = await trpcClient.message.getByChatUid({
          chatUid,
          limit: r.to - r.from + 1,
          order: 'asc',
          beforeSeq: r.to,
        })
        msgs.forEach(msg => (chatCache!.messagesBySeq[msg.seq] = msg))
      }

      // 更新 ranges
      chatCache.ranges.push({ from, to })
      set(state => ({ chats: { ...state.chats, [chatUid]: chatCache! } }))

      // 返回指定区间的消息
      const allSeqs = Object.keys(chatCache.messagesBySeq).map(s => Number.parseInt(s))
      const filteredSeqs = allSeqs.filter(seq => seq >= from && seq <= to).sort((a, b) => a - b)
      return filteredSeqs.map(seq => chatCache.messagesBySeq[seq])
    },

    /* ------------------ AI / 创建消息追加 ------------------ */
    appendMessage(chatUid, message) {
      set((state) => {
        const chatCache = state.chats[chatUid] || { messagesBySeq: {}, ranges: [] }
        if (!chatCache.messagesBySeq[message.seq]) {
          chatCache.messagesBySeq[message.seq] = message
        }
        return { chats: { ...state.chats, [chatUid]: chatCache } }
      })
    },

    /* ------------------ 消息更新 ------------------ */
    updateMessage(messageUid, updates) {
      set((state) => {
        // 遍历所有 chat 查找 messageUid
        for (const chat of Object.values(state.chats)) {
          for (const msg of Object.values(chat.messagesBySeq)) {
            if (msg.uid === messageUid) {
              Object.assign(msg, updates)
              return { chats: { ...state.chats } }
            }
          }
        }
        return state
      })
    },

    /* ------------------ 实时消息处理工具 ------------------ */
    pushStreaming(messageUid: string, content: string) {
      streamingBuffer.set(messageUid, { content })
      if (rafId == null) {
        rafId = requestAnimationFrame(flushStreaming)
      }
    },
  }
})

/* ------------------------------------------------------------------ */
/* 工具函数 / 类型 / 测试辅助函数 */
/* ------------------------------------------------------------------ */
export function sortMessagesBySeqAsc(messages: Message[]): Message[] {
  return [...messages].sort((a, b) => a.seq - b.seq)
}
