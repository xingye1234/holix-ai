/**
 * @fileoverview useChatVirtualList
 *
 * 聊天消息虚拟列表的业务适配 Hook，衔接：
 *  - MessageStore（消息数据、加载操作）
 *  - VirtualMessageList（虚拟化渲染）
 *  - 实时消息更新（streaming / created / updated）
 *
 * 职责：
 *  - 维护 hasMoreTop / loadingTopState
 *  - 在 onLoadMoreTop 前调用 captureAnchor 防止跳动
 *  - 在 AI 流式输出时跟随底部滚动
 *  - 暴露命令式 listRef 供父组件调用 scrollToIndex / scrollToBottom
 */

import type { RefObject } from 'react'
import type { LoadingState, ScrollBehavior, VirtualListHandle } from '@/components/virtual-list'
import type { Message } from '@/node/database/schema/chat'
import { useCallback, useRef, useState } from 'react'
import { useChatContext } from '@/context/chat'
import { useChatMessages, useInitialMessageLoad, useLoadMoreMessages } from '@/hooks/message'
import { useRafThrottle } from '@/hooks/throttle'
import useUpdate from '@/hooks/update'
import logger from '@/lib/logger'
import { useMessageStore } from '@/store/message'

export interface ChatVirtualListState {
  /** 消息 ID 列表 */
  messageIds: string[]
  /** 是否有更多历史消息 */
  hasMoreTop: boolean
  /** 顶部加载状态 */
  loadingTopState: LoadingState
  /** 触发加载更多历史 */
  onLoadMoreTop: () => Promise<void>
  /** followOutput 回调 */
  followOutputBehavior: (isAtBottom: boolean) => ScrollBehavior | false
  /** 底部状态变更 */
  onAtBottomStateChange: (atBottom: boolean) => void
  /** 删除消息 */
  onDeleteMessage: (messageId: string) => Promise<void>
  /** 命令式列表 ref */
  listRef: RefObject<VirtualListHandle | null>
}

export function useChatVirtualList(): ChatVirtualListState {
  const { chat } = useChatContext()
  const chatUid = chat?.uid ?? ''

  const messages = useChatMessages(chatUid)
  useInitialMessageLoad(chatUid)
  const loadMore = useLoadMoreMessages(chatUid)

  const listRef = useRef<VirtualListHandle>(null)

  // ── 顶部加载状态管理 ─────────────────────────────────────────────────────

  const [loadingTopState, setLoadingTopState] = useState<LoadingState>('idle')
  const [hasMoreTop, setHasMoreTop] = useState(true)
  const prevMessageCountRef = useRef(0)

  const onLoadMoreTop = useCallback(async () => {
    if (loadingTopState === 'loading' || !hasMoreTop)
      return

    logger.info('ChatVirtualList: Loading older messages...')
    setLoadingTopState('loading')

    const countBefore = messages.length

    try {
      await loadMore()

      // 加载后判断是否还有更多：若 count 没变则认为已到顶
      // (下次 re-render 后 messages 数组会更新，在 effect 中检查)
      prevMessageCountRef.current = countBefore
    }
    catch (err) {
      logger.error('ChatVirtualList: loadMore failed', err)
      setLoadingTopState('error')
    }
    finally {
      setLoadingTopState('idle')
    }
  }, [loadingTopState, hasMoreTop, messages.length, loadMore])

  // 当 messages 从 N 变为 N（加载后没变），说明没有更多了
  // 使用 ref 避免循环依赖
  const messagesLengthRef = useRef(messages.length)
  if (messages.length !== messagesLengthRef.current) {
    if (
      prevMessageCountRef.current > 0
      && messages.length === prevMessageCountRef.current
    ) {
      // 没有加载到新内容 → 没有更多了
      setHasMoreTop(false)
    }
    messagesLengthRef.current = messages.length
  }

  // ── 跟随底部 ─────────────────────────────────────────────────────────────

  const isAtBottomRef = useRef(true)

  const onAtBottomStateChange = useCallback((atBottom: boolean) => {
    isAtBottomRef.current = atBottom
  }, [])

  const followOutputBehavior = useCallback((isAtBottom: boolean): ScrollBehavior | false => {
    return isAtBottom ? 'smooth' : false
  }, [])

  // ── streaming 自动滚动 ────────────────────────────────────────────────────

  const scrollToBottom = useRafThrottle(() => {
    if (!isAtBottomRef.current) {
      logger.warn('ChatVirtualList: Not at bottom, skipping auto-scroll')
      return
    }
    listRef.current?.scrollToBottom('smooth')
  }, [])

  const handleStreamingUpdate = useCallback((payload: { chatUid: string, message?: Message }) => {
    if (!chat)
      return
    if (payload.message && payload.message.role === 'user')
      return
    if (payload.chatUid !== chat.uid)
      return
    scrollToBottom()
  }, [chat, scrollToBottom])

  useUpdate('message.streaming', handleStreamingUpdate)
  useUpdate('message.created', handleStreamingUpdate)
  useUpdate('message.updated', handleStreamingUpdate)

  // ── 删除消息 ──────────────────────────────────────────────────────────────

  const deleteMessage = useMessageStore(state => state.deleteMessage)

  const onDeleteMessage = useCallback(async (messageId: string) => {
    try {
      await deleteMessage(messageId)
      logger.info(`ChatVirtualList: Message ${messageId} deleted`)
    }
    catch (err) {
      logger.error(`ChatVirtualList: deleteMessage failed for ${messageId}`, err)
    }
  }, [deleteMessage])

  return {
    messageIds: messages,
    hasMoreTop,
    loadingTopState,
    onLoadMoreTop,
    followOutputBehavior,
    onAtBottomStateChange,
    onDeleteMessage,
    listRef,
  }
}
