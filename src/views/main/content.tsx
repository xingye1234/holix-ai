import type { VListHandle } from 'virtua'
import { memo, useCallback, useRef } from 'react'
import { VList } from 'virtua'
import { useChatContext } from '@/context/chat'
import { useChatMessages, useInitialMessageLoad, useLoadMoreMessages } from '@/hooks/message'
import { MessageItem } from './message-item'

export const MainContent = memo(() => {
  const { chat } = useChatContext()
  const vListRef = useRef<VListHandle>(null)
  // 订阅 store 消息
  const messages = useChatMessages(chat?.uid ?? '')
  // 首次加载最新消息
  useInitialMessageLoad(chat?.uid ?? '')
  // 滚动加载更多历史
  const loadMore = useLoadMoreMessages(chat?.uid ?? '')

  const handleScroll = useCallback((offset: number) => {
    if (offset === 0) {
      loadMore()
    }
  }, [])

  return (
    <main className="h-(--app-chat-content-height)">
      <VList
        ref={vListRef}
        style={{ height: 'var(--app-chat-content-height)' }}
        onScroll={handleScroll}
      >
        {messages.map((msg, index) => (
          <MessageItem key={msg} id={msg} index={index} />
        ))}
      </VList>
    </main>
  )
})
