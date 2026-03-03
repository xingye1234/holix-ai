import type { VirtuosoHandle } from 'react-virtuoso'
import type { Message } from '@/node/database/schema/chat'
import { AnimatePresence, motion } from 'framer-motion'
import { Virtuoso } from 'react-virtuoso'
import { useChatContext } from '@/context/chat'
import { useChatMessages, useInitialMessageLoad, useLoadMoreMessages } from '@/hooks/message'
import { useRafThrottle } from '@/hooks/throttle'
import useUpdate from '@/hooks/update'
import logger from '@/lib/logger'
import { useMessageStore } from '@/store/message'
import { MessageItem } from './message-item'

export const MainContent = memo(() => {
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const { chat } = useChatContext()
  // 订阅 store 消息
  const messages = useChatMessages(chat?.uid ?? '')
  // 首次加载最新消息
  useInitialMessageLoad(chat?.uid ?? '')
  // 滚动加载更多历史
  const loadMore = useLoadMoreMessages(chat?.uid ?? '')

  // 追踪列表是否处于底部，用于决定是否跟随滚动
  const isAtBottomRef = useRef(true)

  // 滚动到顶部时加载更多历史消息
  const handleStartReached = useCallback(async () => {
    logger.info('MainContent: Scroll to top, loading more messages...')
    loadMore()
  }, [loadMore])

  // followOutput：仅当用户已在底部时才自动跟随新消息滚动到底部
  const followOutput = useCallback((_isAtBottom: boolean) => {
    return isAtBottomRef.current ? ('smooth' as const) : false
  }, [])

  // streaming / 消息更新事件：若当前在底部则平滑滚动到最新消息
  const scrollToBottom = useRafThrottle(() => {
    const lastIndex = messages.length - 1
    if (lastIndex < 0 || !isAtBottomRef.current) {
      logger.warn('MainContent: Not at bottom, skipping auto-scroll')
      return
    }
    virtuosoRef.current?.scrollToIndex({ index: lastIndex, align: 'end', behavior: 'smooth' })
  }, [messages.length])

  // 切换会话时立即跳转到最新消息
  useLayoutEffect(() => {
    if (!messages.length)
      return
    setTimeout(() => {
      virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, align: 'end' })
      logger.info('MainContent: Initial scroll to bottom')
    }, 0)
  }, [chat?.uid])

  const toButton = useCallback((payload: { chatUid: string, message?: Message }) => {
    if (!chat)
      return
    // 忽略用户自己的消息
    if (payload.message && payload.message.role === 'user')
      return
    if (payload.chatUid !== chat?.uid)
      return
    scrollToBottom()
  }, [chat, scrollToBottom])

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
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={chat?.uid ?? '__empty'}
          className="size-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
        >
          <Virtuoso
            ref={virtuosoRef}
            style={{ height: 'var(--app-chat-content-height)' }}
            data={messages}
            initialTopMostItemIndex={messages.length > 0 ? messages.length - 1 : 0}
            followOutput={followOutput}
            startReached={handleStartReached}
            atBottomStateChange={atBottom => (isAtBottomRef.current = atBottom)}
            itemContent={(index, msgId) => (
              <MessageItem id={msgId} index={index} onDelete={onDeleteMessage} />
            )}
          />
        </motion.div>
      </AnimatePresence>
    </main>
  )
})
