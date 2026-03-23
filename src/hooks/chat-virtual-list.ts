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
 *
 * 多消息流式生成优化：
 *  - 检测多个消息同时生成时，使用即时滚动（auto）避免抖动
 *  - 单个消息生成时使用平滑滚动（smooth）提升体验
 *  - 批量处理滚动更新，减少频繁的滚动操作
 */

import type { RefObject } from 'react'
import type { LoadingState, ScrollBehavior, VirtualListHandle } from '@/components/virtual-list'
import type { Message } from '@/node/database/schema/chat'
import { useCallback, useRef, useState } from 'react'
import { useChatContext } from '@/context/chat'
import { useChatMessages, useInitialMessageLoad, useLoadMoreMessages } from '@/hooks/message'
import useUpdate from '@/hooks/update'
import logger from '@/lib/logger'
import { useMessageStore } from '@/store/message'
import type { MessageCreatedEnvelope, MessageStreamingEnvelope, MessageUpdatedEnvelope } from '@/types/updates/message'

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
  /** 当前正在流式生成的消息数量（用于调试） */
  streamingCount: number
}

export function useChatVirtualList(): ChatVirtualListState {
  const { chat } = useChatContext()
  const chatUid = chat?.uid ?? ''

  const messages = useChatMessages(chatUid)
  useInitialMessageLoad(chatUid)
  const loadMore = useLoadMoreMessages(chatUid)

  const listRef = useRef<VirtualListHandle>(null)

  // ── 流式消息跟踪（多消息生成优化）───────────────────────────────────────────

  const streamingMessagesRef = useRef<Set<string>>(new Set())
  const [streamingCount, setStreamingCount] = useState(0)

  // 更新流式消息计数
  const updateStreamingCount = useCallback(() => {
    const count = streamingMessagesRef.current.size
    setStreamingCount(count)
  }, [])

  // 检查是否在流式生成中
  const isStreamingMessage = useCallback((messageId: string): boolean => {
    const message = useMessageStore.getState().messages[messageId]
    return message?.status === 'streaming' || message?.status === 'pending'
  }, [])

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

  // ── 跟随底部（智能滚动策略）────────────────────────────────────────────────

  const isAtBottomRef = useRef(true)

  const onAtBottomStateChange = useCallback((atBottom: boolean) => {
    isAtBottomRef.current = atBottom
  }, [])

  /**
   * 智能滚动策略：
   * - 多个消息同时生成时使用 'auto'（即时滚动，避免抖动）
   * - 单个消息生成时使用 'smooth'（平滑滚动，提升体验）
   * - 只有在底部时才跟随
   */
  const followOutputBehavior = useCallback((isAtBottom: boolean): ScrollBehavior | false => {
    if (!isAtBottom) {
      return false
    }
    const streamingCount = streamingMessagesRef.current.size
    // 多个消息流式生成时，使用即时滚动避免抖动
    if (streamingCount >= 2) {
      return 'auto'
    }
    // 单个消息或无流式生成时，使用平滑滚动
    return 'smooth'
  }, [])

  const scheduleScrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToBottom(behavior)
    })
  }, [])

  // ── streaming 自动滚动（多消息优化）───────────────────────────────────────────

  /**
   * 处理流式更新：
   * 1. 跟踪流式消息状态
   * 2. 更新 streamingCount，影响 followOutputBehavior 的决策
   *
   * 注意：不在这里直接调用 scrollToBottom，而是通过 followOutputBehavior
   * 让虚拟列表自己处理滚动，避免双重滚动导致抖动
   */
  const handleStreamingUpdate = useCallback((payload: MessageCreatedEnvelope['payload'] | MessageStreamingEnvelope['payload'] | MessageUpdatedEnvelope['payload']) => {
    if (!chat)
      return
    if (payload.chatUid !== chat.uid)
      return

    const messageId = 'messageUid' in payload ? payload.messageUid : payload.message?.uid
    if (!messageId)
      return

    const message = useMessageStore.getState().messages[messageId]
    const messageRole = 'message' in payload ? payload.message?.role : message?.role
    if (messageRole === 'user')
      return

    // 更新流式消息跟踪
    const isStreaming = isStreamingMessage(messageId)
    const wasStreaming = streamingMessagesRef.current.has(messageId)

    if (isStreaming && !wasStreaming) {
      // 新开始流式生成
      streamingMessagesRef.current.add(messageId)
      updateStreamingCount()
      logger.debug(`ChatVirtualList: Message ${messageId} started streaming (count: ${streamingMessagesRef.current.size})`)
    }
    else if (!isStreaming && wasStreaming) {
      // 流式生成完成
      streamingMessagesRef.current.delete(messageId)
      updateStreamingCount()
      logger.debug(`ChatVirtualList: Message ${messageId} finished streaming (count: ${streamingMessagesRef.current.size})`)

      if (isAtBottomRef.current) {
        const behavior = followOutputBehavior(true)
        if (behavior) {
          scheduleScrollToBottom(behavior)
        }
      }
    }

    // 滚动由 followOutputBehavior + 虚拟列表自动处理，不需要手动调用
  }, [chat, followOutputBehavior, isStreamingMessage, scheduleScrollToBottom, updateStreamingCount])

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
    streamingCount,
  }
}
