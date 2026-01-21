import type { VListHandle } from 'virtua'
import { memo, useCallback, useEffect, useRef } from 'react'
import { VList } from 'virtua'
import { useChatContext } from '@/context/chat'
import { useChatMessages, useInitialMessageLoad, useLoadMoreMessages } from '@/hooks/message'
import { useRafThrottle } from '@/hooks/throttle'
import useUpdate from '@/hooks/update'
import logger from '@/lib/logger'
import { useMessageStore } from '@/store/message'
import { MessageItem } from './message-item'

export const MainContent = memo(() => {
  const vListRef = useRef<VListHandle>(null)
  const { chat } = useChatContext()
  // 订阅 store 消息
  const messages = useChatMessages(chat?.uid ?? '')
  // 首次加载最新消息
  useInitialMessageLoad(chat?.uid ?? '')
  // 滚动加载更多历史
  const loadMore = useLoadMoreMessages(chat?.uid ?? '')

  const handleScroll = useCallback((offset: number) => {
    if (offset === 0) {
      logger.info('MainContent: Scroll to top, loading more messages...')
      loadMore()
    }
  }, [])

  const scrollButton = useRafThrottle(() => {
    const list = vListRef.current
    if (!list)
      return

    const lastIndex = messages.length - 1

    if (lastIndex < 0)
      return

    const { scrollOffset, viewportSize, scrollSize } = list

    const THRESHOLD = Math.max(100, viewportSize * 0.25)

    const isAtBottom = scrollOffset + viewportSize >= scrollSize - THRESHOLD

    if (isAtBottom) {
      list.scrollToIndex(messages.length - 1, {
        align: 'end',
        smooth: true,
      })
      logger.info('MainContent: Auto scroll to bottom on new message')
    }
  }, [messages.length])

  useEffect(() => {
    if (!messages.length)
      return

    const list = vListRef.current
    if (!list)
      return

    list.scrollToIndex(messages.length - 1, {
      align: 'end',
    })

    logger.info('MainContent: Initial scroll to bottom')
  }, [messages.length, chat?.uid])

  const toButton = useCallback((payload: { chatUid: string }) => {
    if (!chat) {
      return
    }
    if (payload.chatUid !== chat?.uid) {
      return
    }
    scrollButton()
  }, [chat, scrollButton])

  useUpdate('message.streaming', toButton)
  useUpdate('message.created', toButton)
  useUpdate('message.updated', toButton)

  const deleteMessage = useMessageStore(state => state.deleteMessage)

  const onDeleteMessage = useCallback(async (messageId: string) => {
    try {
      await deleteMessage(messageId)
      logger.info(`MainContent: Message ${messageId} deleted, refreshing list`)
    }
    catch (err) {
      logger.error(`MainContent: deleteMessage failed for ${messageId}`, err)
    }
  }, [deleteMessage])

  return (
    <main className="h-(--app-chat-content-height)">
      <VList ref={vListRef} style={{ height: 'var(--app-chat-content-height)' }} onScroll={handleScroll}>
        {messages.map((msg, index) => (
          <MessageItem key={msg} id={msg} index={index} onDelete={onDeleteMessage} />
        ))}
      </VList>
    </main>
  )
})
