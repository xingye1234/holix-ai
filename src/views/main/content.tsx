import type { VirtuosoHandle } from 'react-virtuoso'
import { memo, useEffect, useRef } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { useChatContext } from '@/context/chat'
import { useChatMessageIds } from '@/hooks/message'
import { useMessageStore } from '@/store/message'
import { MessageItem } from './message-item'

// 自动滚动阈值：距离底部小于此值时自动滚动（单位：像素）
const AUTO_SCROLL_THRESHOLD = 150

// ✅ Telegram 架构：只订阅消息 ID 列表，不订阅消息内容
export const MainContent = memo(() => {
  const { chat } = useChatContext()
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  // ✅ 只获取消息 ID 数组，不包含消息内容
  const messageIds = useChatMessageIds(chat?.uid)
  const isAtBottomRef = useRef(true)
  const isUserScrollingRef = useRef(false)
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null)
  const initialIndex = useRef<number | null>(null)

  if (initialIndex.current === null && messageIds.length > 0) {
    initialIndex.current = messageIds.length - 1
  }

  // eslint-disable-next-line no-console
  console.log('MainContent render: chat ID =', chat?.uid, 'message count =', messageIds.length)

  // 新消息添加时自动滚动
  useEffect(() => {
    if (messageIds.length === 0)
      return

    // 如果用户正在主动滚动，不自动滚动
    if (isUserScrollingRef.current)
      return

    // 如果接近底部，自动滚动到最新消息
    if (isAtBottomRef.current) {
      virtuosoRef.current?.scrollToIndex({
        index: messageIds.length - 1,
        align: 'end',
        behavior: 'smooth',
      })
    }
  }, [messageIds.length])

  // 监听流式更新，不触发组件重渲染
  useEffect(() => {
    if (messageIds.length === 0)
      return

    const lastMessageId = messageIds[messageIds.length - 1]
    if (!lastMessageId)
      return

    // 直接订阅 store 变化，不触发 MainContent 重渲染
    const unsubscribe = useMessageStore.subscribe((state, prevState) => {
      const message = state.messagesById?.[lastMessageId]
      const prevMessage = prevState.messagesById?.[lastMessageId]

      if (!message || !prevMessage)
        return

      // 只在流式消息内容变化时触发滚动
      if (
        message.status === 'streaming'
        && message.content !== prevMessage.content
        && isAtBottomRef.current
        && !isUserScrollingRef.current
      ) {
        virtuosoRef.current?.scrollToIndex({
          index: messageIds.length - 1,
          align: 'end',
          behavior: 'auto',
        })
      }
    })

    return unsubscribe
  }, [messageIds])

  return (
    <main ref={wrapperRef} className="h-(--app-chat-content-height)">
      <Virtuoso
        ref={virtuosoRef}
        data={messageIds}
        style={{ height: 'var(--app-chat-content-height)' }}
        className="custom-scrollbar"
        increaseViewportBy={{ top: 0, bottom: 200 }}
        followOutput={(isAtBottom) => {
          // 如果用户正在主动滚动，不自动跟随
          if (isUserScrollingRef.current)
            return false
          // 如果在底部，平滑滚动
          return isAtBottom ? 'smooth' : false
        }}
        atBottomStateChange={(bottom) => {
          isAtBottomRef.current = bottom
        }}
        isScrolling={(scrolling) => {
          // 跟踪用户是否正在滚动
          if (scrolling) {
            isUserScrollingRef.current = true
            // 清除之前的计时器
            if (scrollTimerRef.current) {
              clearTimeout(scrollTimerRef.current)
            }
          }
          else {
            // 滚动停止后 300ms 认为用户不再主动滚动
            scrollTimerRef.current = setTimeout(() => {
              isUserScrollingRef.current = false
            }, 300)
          }
        }}
        atBottomThreshold={AUTO_SCROLL_THRESHOLD}
        initialTopMostItemIndex={
          initialIndex.current != null ? { index: initialIndex.current } : undefined
        }
        itemContent={(index, messageId) => (
          // ✅ 只传递 messageId，MessageItem 自己订阅消息数据
          <MessageItem key={messageId} index={index} messageId={messageId} />
        )}
      />
    </main>
  )
})
