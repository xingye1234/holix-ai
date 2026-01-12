import type { Message } from '@/node/database/schema/chat'
import { createWithEqualityFn } from 'zustand/traditional'
import { getChatViewport, setChatViewport } from '@/lib/chat-viewers'
import { trpcClient } from '@/lib/trpc-client'

/* =========================================================
 * 冷路径工具：消息排序（只允许 init / load 使用）
 * ======================================================= */

/**
 * 冷路径：按 seq 升序排序消息
 * ⚠️ 禁止在实时更新 / stream 路径中使用
 */
function sortMessagesBySeqAscCold(messages: readonly Message[]): Message[] {
  if (messages.length <= 1)
    return messages.slice()
  return [...messages].sort((a, b) => a.seq - b.seq)
}

/* =========================================================
 * Store 定义（Telegram 架构：扁平化存储 + ID 索引）
 * ======================================================= */

interface MessageStore {
  // 扁平化存储：所有消息按 ID 存储
  messagesById: Record<string, Message>
  // 聊天消息 ID 索引：每个聊天只存储消息 ID 列表
  chatMessageIds: Record<string, string[]>
  // 消息范围记录：每个聊天当前加载的消息范围 (minSeq, maxSeq)
  chatMessageRange: Record<string, { minSeq: number, maxSeq: number, hasMore: boolean, hasNewer: boolean }>
  // 可视区域记录：每个聊天当前可见的消息范围（用于恢复位置）
  chatViewport: Record<string, { firstVisibleSeq: number, lastVisibleSeq: number }>

  isLoading: boolean
  initialized: boolean

  /* 冷路径 */
  init: () => Promise<void>
  loadMessages: (chatUid: string) => Promise<void>
  loadMoreMessages: (chatUid: string) => Promise<void>
  loadNewerMessages: (chatUid: string) => Promise<void>

  /* 热路径 */
  appendMessage: (chatUid: string, message: Message) => void
  appendMessages: (chatUid: string, messages: Message[]) => void
  prependMessages: (chatUid: string, messages: Message[]) => void

  updateMessage: (messageUid: string, updates: Partial<Message>) => void

  /* 可视区域管理 */
  updateViewport: (chatUid: string, firstVisibleSeq: number, lastVisibleSeq: number) => void
  getViewport: (chatUid: string) => { firstVisibleSeq: number, lastVisibleSeq: number } | null

  /* Selectors */
  getMessageById: (messageUid: string) => Message | undefined
  getChatMessageIds: (chatUid: string) => string[]
  hasMoreMessages: (chatUid: string) => boolean
  hasNewerMessages: (chatUid: string) => boolean
}

/* =========================================================
 * Store 实现（Telegram 架构：扁平化存储 + ID 索引）
 * ======================================================= */

export const useMessageStore = createWithEqualityFn<MessageStore>()((set, get) => ({
  messagesById: {},
  chatMessageIds: {},
  chatMessageRange: {},
  chatViewport: {},
  isLoading: false,
  initialized: false,

  /* ---------- 冷路径 ---------- */

  async init() {
    if (get().initialized)
      return

    set({ isLoading: true })

    try {
      const chats = await trpcClient.chat.list()
      const messagesById: Record<string, Message> = {}
      const chatMessageIds: Record<string, string[]> = {}
      const chatMessageRange: Record<string, { minSeq: number, maxSeq: number, hasMore: boolean, hasNewer: boolean }> = {}
      const chatViewport: Record<string, { firstVisibleSeq: number, lastVisibleSeq: number }> = {}

      await Promise.all(
        chats.map(async (chat) => {
          // 尝试从本地存储恢复上次的可视区域
          const savedViewport = await getChatViewport(chat.uid)

          let msgs: Message[]
          if (savedViewport) {
            // 从上次位置开始加载，向上和向下各加载15条
            const centerSeq = Math.floor((savedViewport.firstVisibleSeq + savedViewport.lastVisibleSeq) / 2)
            msgs = await trpcClient.message.getByChatUid({
              chatUid: chat.uid,
              beforeSeq: centerSeq + 15,
              limit: 30,
              order: 'desc',
            })
          }
          else {
            // 首次加载，加载最新30条
            msgs = await trpcClient.message.getByChatUid({
              chatUid: chat.uid,
              limit: 30,
              order: 'desc',
            })
          }

          // 反转为升序
          const sorted = sortMessagesBySeqAscCold(msgs.reverse())

          if (sorted.length > 0) {
            // 扁平化存储消息
            sorted.forEach((msg) => {
              messagesById[msg.uid] = msg
            })

            // 存储消息 ID 列表
            chatMessageIds[chat.uid] = sorted.map(msg => msg.uid)

            // 记录消息范围
            chatMessageRange[chat.uid] = {
              minSeq: sorted[0].seq,
              maxSeq: sorted[sorted.length - 1].seq,
              hasMore: msgs.length === 30, // 如果返回30条，可能还有更多
              hasNewer: false, // 初始加载时假设没有更新的
            }

            // 恢复或初始化可视区域
            if (savedViewport) {
              chatViewport[chat.uid] = savedViewport
            }
            else {
              // 默认显示最后几条消息
              chatViewport[chat.uid] = {
                firstVisibleSeq: Math.max(sorted[0].seq, sorted[sorted.length - 1].seq - 10),
                lastVisibleSeq: sorted[sorted.length - 1].seq,
              }
            }
          }
        }),
      )

      set({
        messagesById,
        chatMessageIds,
        chatMessageRange,
        chatViewport,
        initialized: true,
        isLoading: false,
      })
    }
    catch (err) {
      console.error('[message-store] init failed', err)
      set({ isLoading: false })
    }
  },

  async loadMessages(chatUid) {
    set({ isLoading: true })

    try {
      // 尝试从本地存储恢复上次的可视区域
      const savedViewport = await getChatViewport(chatUid)

      let msgs: Message[]
      if (savedViewport) {
        // 从上次位置开始加载
        const centerSeq = Math.floor((savedViewport.firstVisibleSeq + savedViewport.lastVisibleSeq) / 2)
        msgs = await trpcClient.message.getByChatUid({
          chatUid,
          beforeSeq: centerSeq + 15,
          limit: 30,
          order: 'desc',
        })
      }
      else {
        // 首次加载，加载最新30条
        msgs = await trpcClient.message.getByChatUid({
          chatUid,
          limit: 30,
          order: 'desc',
        })
      }

      // 反转为升序
      const sorted = sortMessagesBySeqAscCold(msgs.reverse())

      set((state) => {
        const newMessagesById = { ...state.messagesById }

        // 扁平化存储消息
        sorted.forEach((msg) => {
          newMessagesById[msg.uid] = msg
        })

        const newRange = sorted.length > 0
          ? {
              minSeq: sorted[0].seq,
              maxSeq: sorted[sorted.length - 1].seq,
              hasMore: msgs.length === 30,
              hasNewer: false,
            }
          : { minSeq: 0, maxSeq: 0, hasMore: false, hasNewer: false }

        // 设置或恢复可视区域
        const newViewport = savedViewport || (sorted.length > 0
          ? {
              firstVisibleSeq: Math.max(sorted[0].seq, sorted[sorted.length - 1].seq - 10),
              lastVisibleSeq: sorted[sorted.length - 1].seq,
            }
          : null)

        return {
          messagesById: newMessagesById,
          chatMessageIds: {
            ...state.chatMessageIds,
            [chatUid]: sorted.map(msg => msg.uid),
          },
          chatMessageRange: {
            ...state.chatMessageRange,
            [chatUid]: newRange,
          },
          chatViewport: newViewport
            ? {
                ...state.chatViewport,
                [chatUid]: newViewport,
              }
            : state.chatViewport,
          isLoading: false,
        }
      })
    }
    catch (err) {
      console.error('[message-store] loadMessages failed', err)
      set({ isLoading: false })
    }
  },

  async loadMoreMessages(chatUid) {
    const state = get()
    const range = state.chatMessageRange[chatUid]

    // 没有更多消息或正在加载
    if (!range || !range.hasMore || state.isLoading)
      return

    set({ isLoading: true })

    try {
      // 加载 minSeq 之前的30条消息
      const msgs = await trpcClient.message.getByChatUid({
        chatUid,
        beforeSeq: range.minSeq - 1,
        limit: 30,
        order: 'desc',
      })

      if (msgs.length === 0) {
        set(state => ({
          chatMessageRange: {
            ...state.chatMessageRange,
            [chatUid]: { ...range, hasMore: false },
          },
          isLoading: false,
        }))
        return
      }

      // 反转为升序
      const sorted = sortMessagesBySeqAscCold(msgs.reverse())

      set((state) => {
        const newMessagesById = { ...state.messagesById }
        const currentIds = state.chatMessageIds[chatUid] || []
        const existingSet = new Set(currentIds)

        const incoming = sorted.filter(m => !existingSet.has(m.uid))

        // 扁平化存储消息
        incoming.forEach((msg) => {
          newMessagesById[msg.uid] = msg
        })

        const newMinSeq = sorted.length > 0 ? sorted[0].seq : range.minSeq

        return {
          messagesById: newMessagesById,
          chatMessageIds: {
            ...state.chatMessageIds,
            [chatUid]: [...incoming.map(m => m.uid), ...currentIds],
          },
          chatMessageRange: {
            ...state.chatMessageRange,
            [chatUid]: {
              minSeq: newMinSeq,
              maxSeq: range.maxSeq,
              hasMore: msgs.length === 30,
              hasNewer: range.hasNewer,
            },
          },
          isLoading: false,
        }
      })
    }
    catch (err) {
      console.error('[message-store] loadMoreMessages failed', err)
      set({ isLoading: false })
    }
  },

  async loadNewerMessages(chatUid) {
    const state = get()
    const range = state.chatMessageRange[chatUid]

    // 没有更新的消息或正在加载
    if (!range || !range.hasNewer || state.isLoading)
      return

    set({ isLoading: true })

    try {
      // 加载 maxSeq 之后的30条消息
      const msgs = await trpcClient.message.getByChatUid({
        chatUid,
        beforeSeq: range.maxSeq + 31, // beforeSeq 是小于等于，所以 +31 才能获取之后的30条
        limit: 30,
        order: 'asc', // 升序查询
      })

      if (msgs.length === 0) {
        set(state => ({
          chatMessageRange: {
            ...state.chatMessageRange,
            [chatUid]: { ...range, hasNewer: false },
          },
          isLoading: false,
        }))
        return
      }

      const sorted = sortMessagesBySeqAscCold(msgs)

      set((state) => {
        const newMessagesById = { ...state.messagesById }
        const currentIds = state.chatMessageIds[chatUid] || []
        const existingSet = new Set(currentIds)

        const incoming = sorted.filter(m => !existingSet.has(m.uid))

        // 扁平化存储消息
        incoming.forEach((msg) => {
          newMessagesById[msg.uid] = msg
        })

        const newMaxSeq = sorted.length > 0 ? sorted[sorted.length - 1].seq : range.maxSeq

        return {
          messagesById: newMessagesById,
          chatMessageIds: {
            ...state.chatMessageIds,
            [chatUid]: [...currentIds, ...incoming.map(m => m.uid)],
          },
          chatMessageRange: {
            ...state.chatMessageRange,
            [chatUid]: {
              minSeq: range.minSeq,
              maxSeq: newMaxSeq,
              hasMore: range.hasMore,
              hasNewer: msgs.length === 30,
            },
          },
          isLoading: false,
        }
      })
    }
    catch (err) {
      console.error('[message-store] loadNewerMessages failed', err)
      set({ isLoading: false })
    }
  },

  /* ---------- 热路径（不允许排序） ---------- */

  appendMessage(chatUid, message) {
    set((state) => {
      // ✅ 安全检查
      if (!state.chatMessageIds || !state.messagesById)
        return state

      const currentIds = state.chatMessageIds[chatUid] || []

      // 防重复
      if (currentIds.includes(message.uid)) {
        return state
      }

      // ✅ 关键优化：messagesById 更新不影响 chatMessageIds 数组引用
      return {
        ...state,
        messagesById: {
          ...state.messagesById,
          [message.uid]: message,
        },
        chatMessageIds: {
          ...state.chatMessageIds,
          [chatUid]: [...currentIds, message.uid],
        },
      }
    })
  },

  appendMessages(chatUid, messages) {
    if (messages.length === 0)
      return

    set((state) => {
      // ✅ 安全检查
      if (!state.chatMessageIds || !state.messagesById)
        return state

      const currentIds = state.chatMessageIds[chatUid] || []
      const existingSet = new Set(currentIds)

      const incoming = messages.filter(m => !existingSet.has(m.uid))

      if (incoming.length === 0)
        return state

      const newMessagesById = { ...state.messagesById }
      incoming.forEach((msg) => {
        newMessagesById[msg.uid] = msg
      })

      // 更新范围
      const range = state.chatMessageRange[chatUid]
      const newMaxSeq = incoming.length > 0 ? Math.max(...incoming.map(m => m.seq)) : range?.maxSeq || 0

      return {
        ...state,
        messagesById: newMessagesById,
        chatMessageIds: {
          ...state.chatMessageIds,
          [chatUid]: [...currentIds, ...incoming.map(m => m.uid)],
        },
        chatMessageRange: {
          ...state.chatMessageRange,
          [chatUid]: {
            minSeq: range?.minSeq || incoming[0]?.seq || 0,
            maxSeq: newMaxSeq,
            hasMore: range?.hasMore || false,
            hasNewer: false, // 新消息追加到末尾，没有更新的了
          },
        },
      }
    })
  },

  prependMessages(chatUid, messages) {
    if (messages.length === 0)
      return

    set((state) => {
      // ✅ 安全检查
      if (!state.chatMessageIds || !state.messagesById)
        return state

      const currentIds = state.chatMessageIds[chatUid] || []
      const existingSet = new Set(currentIds)

      const incoming = messages.filter(m => !existingSet.has(m.uid))

      if (incoming.length === 0)
        return state

      const newMessagesById = { ...state.messagesById }
      incoming.forEach((msg) => {
        newMessagesById[msg.uid] = msg
      })

      return {
        ...state,
        messagesById: newMessagesById,
        chatMessageIds: {
          ...state.chatMessageIds,
          [chatUid]: [...incoming.map(m => m.uid), ...currentIds],
        },
      }
    })
  },

  // ✅ 关键改进：只需要 messageUid，不需要 chatUid
  updateMessage(messageUid, updates) {
    set((state) => {
      // ✅ 安全检查
      if (!state.messagesById)
        return state

      const existingMessage = state.messagesById[messageUid]
      if (!existingMessage)
        return state

      // ✅ 只更新 messagesById，chatMessageIds 数组引用完全不变！
      return {
        ...state,
        messagesById: {
          ...state.messagesById,
          [messageUid]: {
            ...existingMessage,
            ...updates,
          },
        },
      }
    })
  },

  /* ---------- 可视区域管理 ---------- */

  updateViewport(chatUid, firstVisibleSeq, lastVisibleSeq) {
    set((state) => {
      const newViewport = { firstVisibleSeq, lastVisibleSeq }

      // 保存到本地存储
      setChatViewport(chatUid, newViewport)

      return {
        ...state,
        chatViewport: {
          ...state.chatViewport,
          [chatUid]: newViewport,
        },
      }
    })
  },

  getViewport(chatUid) {
    const viewport = get().chatViewport[chatUid]
    return viewport || null
  },

  /* ---------- Selectors ---------- */

  getMessageById(messageUid) {
    return get().messagesById[messageUid]
  },

  getChatMessageIds(chatUid) {
    return get().chatMessageIds[chatUid] || []
  },

  hasMoreMessages(chatUid) {
    const range = get().chatMessageRange[chatUid]
    return range?.hasMore || false
  },

  hasNewerMessages(chatUid) {
    const range = get().chatMessageRange[chatUid]
    return range?.hasNewer || false
  },
}))
