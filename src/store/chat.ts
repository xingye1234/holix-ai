import type { Chat } from '@/node/database/schema/chat'
import { create } from 'zustand'
import logger from '@/lib/logger'
import { trpcClient } from '@/lib/trpc-client'

interface ChatStore {
  chats: Chat[]
  isLoading: boolean
  initialized: boolean
  searchQuery: string
  setSearchQuery: (query: string) => void
  // 初始化
  init: () => Promise<void>
  // 加载所有会话
  loadChats: () => Promise<void>
  // 创建新会话
  createChat: (params: {
    provider: string
    model: string
    title?: string
  }) => Promise<Chat | null>
  // 添加会话到列表
  addChat: (chat: Chat) => void
  // 更新会话
  updateChat: (chatUid: string, updates: Partial<Chat>) => void
  // 移除会话
  removeChat: (chatUid: string) => Promise<boolean>
  // 本地移除会话（不触发后端请求），用于接收服务端事件时使用
  removeChatLocal: (chatUid: string) => boolean
}

const useChat = create<ChatStore>((set, get) => {
  return {
    chats: [],
    isLoading: false,
    initialized: false,
    searchQuery: '',

    setSearchQuery: (query: string) => set({ searchQuery: query }),

    init: async () => {
      if (get().initialized)
        return

      try {
        set({ isLoading: true })
        const chats = await trpcClient.chat.list()
        set({ chats, isLoading: false, initialized: true })
      }
      catch (error) {
        console.error('Failed to load chats:', error)
        set({ isLoading: false })
      }
    },

    loadChats: async () => {
      try {
        set({ isLoading: true })
        const chats = await trpcClient.chat.list()
        set({ chats, isLoading: false })
      }
      catch (error) {
        console.error('Failed to load chats:', error)
        set({ isLoading: false })
      }
    },

    createChat: async (params: {
      provider: string
      model: string
      title?: string
    }) => {
      try {
        set({ isLoading: true })
        const chat = await trpcClient.chat.create(params)

        // 添加到列表
        set(state => ({
          chats: [chat, ...state.chats],
          isLoading: false,
        }))

        return chat
      }
      catch (error) {
        console.error('Failed to create chat:', error)
        set({ isLoading: false })
        return null
      }
    },

    addChat: (chat: Chat) => {
      set((state) => {
        // 检查是否已存在，避免重复添加
        if (state.chats.some(c => c.uid === chat.uid)) {
          return state
        }
        return {
          chats: [chat, ...state.chats],
        }
      })
    },

    updateChat: (chatUid: string, updates: Partial<Chat>) => {
      set((state) => {
        const index = state.chats.findIndex(c => c.uid === chatUid)
        if (index === -1)
          return state

        // ✅ 只修改目标 chat 对象，其他 chat 引用保持不变
        const newChats = [...state.chats]
        newChats[index] = {
          ...state.chats[index],
          ...updates,
        }

        return {
          chats: newChats,
        }
      })
    },
    removeChat: async (chatUid: string) => {
      try {
        await trpcClient.chat.delete({ chatUid })
        set(state => ({
          chats: state.chats.filter(c => c.uid !== chatUid),
        }))
        return true
      }
      catch (error) {
        logger.error('Failed to delete chat:', error)
        return false
      }
    },
    removeChatLocal: (chatUid: string) => {
      set(state => ({
        chats: state.chats.filter(c => c.uid !== chatUid),
      }))
      return true
    },
  }
})

export default useChat
