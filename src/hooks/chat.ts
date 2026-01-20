import { useEffect } from 'react'
import { onUpdate } from '@/lib/command'
import useChat from '@/store/chat'

/**
 * 初始化 Chat Store
 * 只在应用启动时调用一次
 */
export function useInitChats() {
  const init = useChat(state => state.init)
  const initialized = useChat(state => state.initialized)

  useEffect(() => {
    if (!initialized) {
      init()
    }
  }, [init, initialized])
}

/**
 * 监听 Chat 更新事件
 * 处理来自后端的实时 chat 推送
 */
export function useChatUpdates() {
  const updateChat = useChat(state => state.updateChat)
  const addChat = useChat(state => state.addChat)

  useEffect(() => {
    // 注册 chat 更新事件监听
    const unsubscribeUpdate = onUpdate('chat.updated', (payload) => {
      updateChat(payload.uid, payload)
    })

    // 注册 chat 删除事件监听
    const unsubscribeDelete = onUpdate('chat.deleted', (payload) => {
      // payload: { uid }
      if (payload && (payload as any).uid) {
        const uid = (payload as any).uid
        // 使用本地移除，避免在接收到服务端删除事件时再次发起删除请求导致循环
        useChat.getState().removeChatLocal(uid)
      }
    })

    // 注册 chat 创建事件监听
    const unsubscribeCreate = onUpdate('chat.create', (payload) => {
      addChat(payload)
    })

    // 清理函数
    return () => {
      if (typeof unsubscribeUpdate === 'function') {
        unsubscribeUpdate()
      }
      if (typeof unsubscribeDelete === 'function') {
        unsubscribeDelete()
      }
      if (typeof unsubscribeCreate === 'function') {
        unsubscribeCreate()
      }
    }
  }, [updateChat, addChat])
}
