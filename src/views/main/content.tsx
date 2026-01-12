import { memo, useEffect, useRef, useState } from 'react'
import { VList } from 'virtua'
import { useChatContext } from '@/context/chat'
import { getChatViewport } from '@/lib/chat-viewers'
import { MessageItem } from './message-item'
// ✅ Telegram 架构：只订阅消息 ID 列表，不订阅消息内容
export const MainContent = memo(() => {
  const { chat } = useChatContext()
  const wrapperRef = useRef<HTMLDivElement>(null)
  // 本次加载的消息 ID 列表 从上次位置开始加载
  const [messages, setMessages] = useState<string[]>([])

  useEffect(() => {
    // 订阅当前 chat 的消息 ID 列表
    (async () => {
      if (!chat?.uid) {
        return
      }

      const preMessageId = await getChatViewport(chat.uid)
    })()
  }, [chat?.uid])

  return (
    <main ref={wrapperRef} className="h-(--app-chat-content-height)">
      <VList style={{
        height: 'h-(--app-chat-content-height)',
      }}
      >
        {
          messages.map((messageId, index) => (
            <MessageItem key={messageId} messageId={messageId} index={index} />
          ))
        }
      </VList>
    </main>
  )
})
