import type { DraftContent, ToolCallTrace } from '@/node/database/schema/chat'
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
  const deleteMessagesByChatUid = useMessageStore(s => s.deleteMessagesByChatUid)

  /**
   * streaming 合帧缓冲
   * key = messageUid
   */
  const streamingBuffer = useRef<
    Map<
      string,
      {
        content: string
        draftContent: DraftContent
        toolCalls: ToolCallTrace[] | null | undefined
      }
    >
  >(new Map())

  const rafId = useRef<number | null>(null)

  const flushStreaming = () => {
    streamingBuffer.current.forEach((value, messageUid) => {
      // ✅ 只更新 content，不设置 status
      // 避免在 done/error/aborted 终态到达后被 RAF 覆盖回 streaming
      updateMessage(messageUid, {
        content: value.content,
        draftContent: value.draftContent,
        toolCalls: value.toolCalls,
        toolStatus: value.toolStatus,
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
        draftContent: payload.draftContent,
        toolCalls: payload.toolCalls,
        toolStatus: payload.toolStatus,
      })

      if (rafId.current == null) {
        rafId.current = requestAnimationFrame(flushStreaming)
      }
    })

    /* message.updated → 最终态 / error / metadata */
    const unsubscribeUpdated = onUpdate('message.updated', (payload) => {
      // 若收到终态，清除 RAF 缓冲中该消息的待处理条目，防止 RAF 延迟触发时覆盖终态
      const terminalStatuses = ['done', 'error', 'aborted'] as const
      if (payload.updates.status && (terminalStatuses as readonly string[]).includes(payload.updates.status)) {
        streamingBuffer.current.delete(payload.messageUid)
      }
      updateMessage(payload.messageUid, payload.updates)
    })

    const unsubscribeChatDelete = onUpdate('chat.deleted', (payload) => {
      logger.info(`Chat ${payload.uid} deleted, removing its messages from store`)
      deleteMessagesByChatUid(payload.uid)
    })

    return () => {
      unsubscribeCreated?.()
      unsubscribeStreaming?.()
      unsubscribeUpdated?.()
      unsubscribeChatDelete?.()

      if (rafId.current != null) {
        cancelAnimationFrame(rafId.current)
      }
    }
  }, [appendMessage, updateMessage, deleteMessagesByChatUid])
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
    loadBefore(chatUid, 10) // 默认每次加载 10 条，可改
  }, [chatUid, messages, loadBefore])
}

export function useMessageById(messageUid: string) {
  return useMessageStore(s => s.getMessageById(messageUid))
}
