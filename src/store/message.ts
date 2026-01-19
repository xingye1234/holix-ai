import type { Message } from '@/node/database/schema/chat'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import logger from '@/lib/logger'
import { trpcClient } from '@/lib/trpc-client'

// 用于返回稳定的空数组，避免 selector 每次返回新数组导致组件重复渲染
const EMPTY_MESSAGE_IDS: string[] = []

/* ---------------------------------- */
/* Store Shape */
/* ---------------------------------- */
interface MessageStore {
  /** chatUid -> messageUid[]（按 seq 升序） */
  chatMessages: Record<string, string[]>

  /** messageUid -> Message */
  messages: Record<string, Message>

  /** 是否已完成首次加载 */
  initialLoaded: Set<string>

  /** ---------------- selectors ---------------- */
  getMessages: (chatUid: string) => string[]

  getMessageById: (messageUid: string) => Message | undefined

  /** ---------------- mutations ---------------- */
  appendMessage: (chatUid: string, message: Message) => void
  prependMessages: (chatUid: string, messages: Message[]) => void
  updateMessage: (messageUid: string, patch: Partial<Message>) => void
  deleteMessage: (messageUid: string) => Promise<void>
  deleteMessagesByChatUid: (chatUid: string) => void

  /** ---------------- loaders ---------------- */
  loadLatest: (chatUid: string, limit?: number) => Promise<void>
  loadBefore: (chatUid: string, limit?: number) => Promise<void>
}

export const useMessageStore = create<MessageStore>()(
  immer((set, get) => ({
    chatMessages: {},
    messages: {},
    initialLoaded: new Set(),

    /* ---------------- selectors ---------------- */
    getMessages(chatUid) {
      const ids = get().chatMessages[chatUid]
      // 自动触发首次加载
      if (!ids || !ids.length) {
        get().loadLatest(chatUid)
      }
      return ids ?? EMPTY_MESSAGE_IDS
    },

    getMessageById(messageUid) {
      return get().messages[messageUid]
    },

    /* ---------------- mutations ---------------- */
    appendMessage(chatUid, message) {
      set((state) => {
        if (state.messages[message.uid])
          return
        state.messages[message.uid] = message

        const list
          = state.chatMessages[chatUid] ?? (state.chatMessages[chatUid] = [])

        list.push(message.uid)
        list.sort((a, b) => state.messages[a].seq - state.messages[b].seq)
      })
    },

    prependMessages(chatUid, messages) {
      set((state) => {
        const list
          = state.chatMessages[chatUid] ?? (state.chatMessages[chatUid] = [])

        const newIds: string[] = []

        for (const msg of messages) {
          if (state.messages[msg.uid])
            continue
          state.messages[msg.uid] = msg
          newIds.push(msg.uid)
        }

        state.chatMessages[chatUid] = [...newIds, ...list]
        state.chatMessages[chatUid].sort(
          (a, b) => state.messages[a].seq - state.messages[b].seq,
        )
      })
    },

    updateMessage(messageUid, patch) {
      set((state) => {
        const msg = state.messages[messageUid]
        if (!msg)
          return
        Object.assign(msg, patch)
      })
    },

    /* ---------------- loaders ---------------- */
    async loadLatest(chatUid, limit = 20) {
      const { initialLoaded } = get()
      if (initialLoaded.has(chatUid))
        return

      const messages: Message[] = await trpcClient.message.getLatest({
        chatUid,
        limit,
      })

      set((state) => {
        const list
          = state.chatMessages[chatUid] ?? (state.chatMessages[chatUid] = [])

        for (const msg of messages) {
          if (state.messages[msg.uid])
            continue
          state.messages[msg.uid] = msg
          list.push(msg.uid)
        }

        list.sort((a, b) => state.messages[a].seq - state.messages[b].seq)
        state.initialLoaded.add(chatUid)
      })
    },

    async loadBefore(chatUid, limit = 10) {
      const chatIds = get().chatMessages[chatUid] ?? []
      const firstSeq
        = chatIds.length > 0 ? get().messages[chatIds[0]].seq : undefined

      logger.info(`MessageStore: Loading ${limit} messages before seq ${firstSeq} for chat ${chatUid}`)

      if (firstSeq === undefined)
        return

      const messages: Message[] = await trpcClient.message.getByChatUid({
        chatUid,
        limit,
        order: 'asc',
        beforeSeq: firstSeq,
      })

      logger.info(`MessageStore: Loaded ${messages.length} messages before seq ${firstSeq} for chat ${chatUid}`)

      if (!messages.length)
        return

      set((state) => {
        const list
          = state.chatMessages[chatUid] ?? (state.chatMessages[chatUid] = [])

        const newIds: string[] = []

        for (const msg of messages) {
          if (state.messages[msg.uid])
            continue
          state.messages[msg.uid] = msg
          newIds.push(msg.uid)
        }

        state.chatMessages[chatUid] = [...newIds, ...list]
        state.chatMessages[chatUid].sort(
          (a, b) => state.messages[a].seq - state.messages[b].seq,
        )
      })
    },

    deleteMessagesByChatUid(chatUid: string) {
      set((state) => {
        const messageIds = state.chatMessages[chatUid]
        if (!messageIds || messageIds.length === 0)
          return

        for (const messageUid of messageIds) {
          delete state.messages[messageUid]
        }
      })
    },

    async deleteMessage(messageUid: string) {
      try {
        // 尝试从本地缓存读取消息，若不存在则回退到后端查询以获取 chatUid
        let msg = get().messages[messageUid]
        if (!msg) {
          try {
            // 可能抛出错误（找不到消息）
            msg = await trpcClient.message.getById({ messageUid })
          }
          catch {
            logger.warn(`MessageStore: deleteMessage - message not found locally or remotely: ${messageUid}`)
            return
          }
        }

        // 调用后端删除
        await trpcClient.message.delete({ messageUid })

        // 从 store 中移除
        set((state) => {
          const local = state.messages[messageUid]
          const chatUid = local ? local.chatUid : msg.chatUid

          if (chatUid && state.chatMessages[chatUid]) {
            state.chatMessages[chatUid] = state.chatMessages[chatUid].filter(id => id !== messageUid)
          }

          if (state.messages[messageUid])
            delete state.messages[messageUid]
        })
      }
      catch (err) {
        logger.error('MessageStore: deleteMessage failed', err)
      }
    },
  })),
)
