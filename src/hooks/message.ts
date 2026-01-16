import { useCallback, useEffect, useRef } from 'react'
import { onUpdate } from '@/lib/command'
import logger from '@/lib/logger'
import { useMessageStore } from '@/store/message'

/* ------------------------------------------------------------------ */
/* 消息实时更新（created / streaming / updated）
 * Telegram 架构：直接通过消息 ID 更新，不影响列表
 * ------------------------------------------------------------------ */

export function useMessageUpdates() {
  const appendMessage = useMessageStore(s => s.appendMessage)
  const updateMessage = useMessageStore(s => s.updateMessage)

  /**
   * streaming 合帧缓冲
   * key = messageUid
   */
  const streamingBuffer = useRef<
    Map<
      string,
      {
        content: string
      }
    >
  >(new Map())

  const rafId = useRef<number | null>(null)

  const flushStreaming = () => {
    streamingBuffer.current.forEach((value, messageUid) => {
      // ✅ 只需要 messageUid，不需要 chatUid
      updateMessage(messageUid, {
        content: value.content,
        status: 'streaming',
      })
    })

    streamingBuffer.current.clear()
    rafId.current = null
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    logger.info('Initializing message updates listener...')

    /* message.created → appendMessage（热路径，不排序） */
    const unsubscribeCreated = onUpdate('message.created', (payload) => {
      appendMessage(payload.chatUid, payload.message)
    })

    /* message.streaming → 合帧 updateMessage */
    const unsubscribeStreaming = onUpdate('message.streaming', (payload) => {
      streamingBuffer.current.set(payload.messageUid, {
        content: payload.content,
      })

      if (rafId.current == null) {
        rafId.current = requestAnimationFrame(flushStreaming)
      }
    })

    /* message.updated → 最终态 / error / metadata */
    const unsubscribeUpdated = onUpdate('message.updated', (payload) => {
      // ✅ 只需要 messageUid
      updateMessage(payload.messageUid, payload.updates)
    })

    return () => {
      unsubscribeCreated?.()
      unsubscribeStreaming?.()
      unsubscribeUpdated?.()

      if (rafId.current != null) {
        cancelAnimationFrame(rafId.current)
      }
    }
  }, [appendMessage, updateMessage])
}

export function useChatMessages(chatUid: string) {
  return useMessageStore(s => s.getMessages(chatUid))
}

/**
 * 首次加载最新消息，只会执行一次
 */
export function useInitialMessageLoad(chatUid: string) {
  const loadLatest = useMessageStore(s => s.loadLatest)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (!chatUid)
      return
    if (loadedRef.current)
      return

    loadedRef.current = true
    loadLatest(chatUid)
  }, [chatUid, loadLatest])
}

/**
 * 滚动到顶部时加载更多历史消息
 */
export function useLoadMoreMessages(chatUid: string) {
  const messages = useChatMessages(chatUid)
  const loadBefore = useMessageStore(s => s.loadBefore)

  return useCallback(() => {
    if (!chatUid)
      return
    const first = messages[0]
    if (!first)
      return

    loadBefore(chatUid, 10) // 默认每次加载 10 条，可改
  }, [chatUid, messages, loadBefore])
}
