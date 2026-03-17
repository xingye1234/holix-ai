/**
 * useMessageJump - 消息跳转 Hook
 *
 * 功能：
 * - 根据 messageId 或 index 跳转到指定消息
 * - 自动补全缺失的中间消息（解决碎片化问题）
 * - 根据距离选择滚动策略（近：滚动，远：直接跳转）
 * - 添加高亮动画效果
 */

import type { VirtualListHandle } from '@/components/virtual-list'
import type { Message } from '@/node/database/schema/chat'
import { useCallback, useEffect, useRef } from 'react'
import logger from '@/lib/logger'
import { useMessageStore } from '@/store/message'

/** 跳转策略 */
export type JumpStrategy = 'smooth' | 'instant' | 'smart'

/** 跳转目标 */
export interface JumpTarget {
  /** 按 ID 跳转 */
  messageId?: string
  /** 按索引跳转 */
  index?: number
  /** 按序列号跳转 */
  seq?: number
}

/** 跳转选项 */
export interface JumpOptions {
  /** 对齐方式 */
  align?: 'start' | 'center' | 'end'
  /** 滚动行为 */
  behavior?: JumpStrategy
  /** 是否高亮（默认 true） */
  highlight?: boolean
  /** 高亮持续时间（毫秒，默认 2000） */
  highlightDuration?: number
}

/** 跳转距离阈值 */
const JUMP_DISTANCE_THRESHOLD = 20

/**
 * 消息跳转 Hook
 */
export function useMessageJump(props: {
  /** 聊天 UID */
  chatUid: string
  /** 虚拟列表句柄 */
  listRef: React.RefObject<VirtualListHandle | null>
  /** 当前消息 ID 列表 */
  messageIds: string[]
}) {
  const { chatUid, listRef, messageIds } = props
  const getMessages = useMessageStore(state => state.getMessages)
  const getMessageById = useMessageStore(state => state.getMessageById)
  const loadBefore = useMessageStore(state => state.loadBefore)

  // 当前高亮的消息 ID
  const highlightedMessageRef = useRef<string | null>(null)

  /**
   * 根据 messageId 查找索引
   */
  const findIndexByMessageId = useCallback((messageId: string): number => {
    return messageIds.findIndex(id => id === messageId)
  }, [messageIds])

  /**
   * 检查并补全缺失的消息
   * 从 startIndex 到 endIndex 之间可能有缺失的消息
   */
  const ensureMessagesInRange = useCallback(async (startIndex: number, endIndex: number) => {
    const start = Math.min(startIndex, endIndex)
    const end = Math.max(startIndex, endIndex)

    logger.info(`useMessageJump: Checking messages from index ${start} to ${end}`)

    // 获取目标范围内的消息 ID
    const targetIds = messageIds.slice(start, end + 1)
    if (targetIds.length === 0)
      return

    // 检查是否有缺失的消息（通过 seq 判断）
    const existingMessages = targetIds
      .map(id => getMessageById(id))
      .filter((msg): msg is Message => msg !== undefined)

    if (existingMessages.length === targetIds.length) {
      // 没有缺失
      logger.info('useMessageJump: All messages in range exist, no need to load')
      return
    }

    // 有缺失，需要加载
    // 获取范围内第一个消息的 seq 作为起点
    const firstMessage = existingMessages[0]
    if (!firstMessage)
      return

    const firstSeq = firstMessage.seq
    const expectedCount = end - start + 1

    logger.info(
      `useMessageJump: Found ${existingMessages.length}/${expectedCount} messages, loading missing...`,
    )

    // 加载该范围内的所有消息
    try {
      const messages: Message[] = await window.api.message.getByChatUid({
        chatUid,
        limit: expectedCount,
        order: 'asc',
        afterSeq: firstSeq - 1, // 从 firstSeq 之前开始，确保包含 firstSeq
      })

      logger.info(`useMessageJump: Loaded ${messages.length} messages from DB`)

      // MessageStore 会自动去重并排序
      // 我们需要手动添加到 store 中
      const prependMessages = useMessageStore.getState().prependMessages
      for (const msg of messages) {
        prependMessages(chatUid, [msg])
      }
    }
    catch (error) {
      logger.error('useMessageJump: Failed to load messages', error)
    }
  }, [chatUid, messageIds, getMessageById, loadBefore])

  /**
   * 决定跳转策略
   * 根据当前索引和目标索引的距离决定使用滚动还是直接跳转
   */
  const determineJumpStrategy = useCallback((currentIndex: number, targetIndex: number): JumpStrategy => {
    const distance = Math.abs(targetIndex - currentIndex)

    // 距离近（< 20）：使用平滑滚动
    if (distance < JUMP_DISTANCE_THRESHOLD) {
      return 'smooth'
    }

    // 距离远（>= 20）：使用即时跳转（避免长时间滚动）
    return 'instant'
  }, [])

  /**
   * 清除高亮效果
   */
  const clearHighlight = useCallback(() => {
    if (highlightedMessageRef.current) {
      const element = document.querySelector(`[data-message-id="${highlightedMessageRef.current}"]`)
      if (element) {
        element.classList.remove('message-highlight')
        element.classList.remove('message-highlight-active')
      }
      highlightedMessageRef.current = null
    }
  }, [])

  /**
   * 添加高亮效果
   */
  const applyHighlight = useCallback((messageId: string, duration = 2000) => {
    // 先清除之前的高亮
    clearHighlight()

    const element = document.querySelector(`[data-message-id="${messageId}"]`)
    if (!element) {
      logger.warn(`useMessageJump: Element not found for message ${messageId}`)
      return
    }

    highlightedMessageRef.current = messageId

    // 添加高亮类
    element.classList.add('message-highlight')

    // 强制重排以触发动画
    void (element as HTMLElement).offsetWidth

    // 激活高亮（开始动画）
    requestAnimationFrame(() => {
      element.classList.add('message-highlight-active')
    })

    // 在指定时间后移除高亮
    setTimeout(() => {
      element.classList.remove('message-highlight-active')
      // 等待动画结束后再移除基础类
      setTimeout(() => {
        element.classList.remove('message-highlight')
        highlightedMessageRef.current = null
      }, 300) // 与 CSS transition 时间匹配
    }, duration)

    logger.info(`useMessageJump: Applied highlight to message ${messageId}`)
  }, [clearHighlight])

  /**
   * 跳转到指定消息
   */
  const jumpToMessage = useCallback(
    async (target: JumpTarget, options: JumpOptions = {}) => {
      const {
        align = 'center',
        behavior = 'smart',
        highlight = true,
        highlightDuration = 2000,
      } = options

      let targetIndex: number | undefined

      // 1. 确定目标索引
      if (target.messageId) {
        targetIndex = findIndexByMessageId(target.messageId)
      }
      else if (target.index !== undefined) {
        targetIndex = target.index
      }
      else if (target.seq !== undefined) {
        // 按 seq 查找
        const messages = getMessages(chatUid)
        const message = messages.find((id) => {
          const msg = getMessageById(id)
          return msg && msg.seq === target.seq
        })
        if (message) {
          targetIndex = findIndexByMessageId(message)
        }
      }

      if (targetIndex === undefined || targetIndex < 0 || targetIndex >= messageIds.length) {
        logger.warn(`useMessageJump: Target message not found`, target)
        return
      }

      logger.info(`useMessageJump: Jumping to index ${targetIndex}`)

      // 2. 获取当前可见的大致索引（简化为使用中间索引）
      const currentIndex = Math.floor(messageIds.length / 2)

      // 3. 确定跳转策略
      const jumpStrategy = behavior === 'smart'
        ? determineJumpStrategy(currentIndex, targetIndex)
        : behavior

      // 4. 补全缺失的消息（如果需要）
      await ensureMessagesInRange(currentIndex, targetIndex)

      // 5. 执行跳转
      requestAnimationFrame(() => {
        const list = listRef.current
        if (!list) {
          logger.error('useMessageJump: listRef is null')
          return
        }

        list.scrollToIndex({
          index: targetIndex,
          align,
          behavior: jumpStrategy === 'instant' ? 'auto' : 'smooth',
        })

        // 6. 添加高亮效果
        if (highlight && targetIndex < messageIds.length) {
          const targetMessageId = messageIds[targetIndex]
          if (targetMessageId) {
            // 等待跳转完成后再高亮
            setTimeout(() => {
              applyHighlight(targetMessageId, highlightDuration)
            }, jumpStrategy === 'instant' ? 100 : 500)
          }
        }
      })
    },
    [
      chatUid,
      messageIds,
      listRef,
      getMessages,
      getMessageById,
      findIndexByMessageId,
      ensureMessagesInRange,
      determineJumpStrategy,
      applyHighlight,
    ],
  )

  /**
   * 清理高亮效果
   */
  useEffect(() => {
    return () => {
      clearHighlight()
    }
  }, [clearHighlight])

  return {
    jumpToMessage,
    clearHighlight,
  }
}
