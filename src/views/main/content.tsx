import type { VListHandle } from 'virtua'
import type { Message } from '@/node/database/schema/chat'
import { memo, useEffect, useRef, useState } from 'react'
import { VList } from 'virtua'
import { useChatContext } from '@/context/chat'
import { getChatViewport } from '@/lib/chat-viewers'
import { onUpdate } from '@/lib/command'
import { useMessageStore } from '@/store/message'
import { MessageItem } from './message-item'

export const MainContent = memo(() => {
  const { chat } = useChatContext()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const vListRef = useRef<VListHandle>(null)
  // 本次加载的消息 ID 列表 从上次位置开始加载
  const [messages, setMessages] = useState<Message[]>([])
  const [offset, setOffset] = useState<number>(0)
  const [isEnd, setIsEnd] = useState<boolean>(false)
  const [isTop, setIsTop] = useState<boolean>(true)

  const getRange = useMessageStore(store => store.getRange)

  console.log('Render MainContent with messages:', messages)

  useEffect(() => {
    console.log('Offset changed:', offset, 'isEnd:', isEnd, 'isTop:', isTop)
  }, [offset, isEnd, isTop])

  useEffect(() => {
    // 订阅当前 chat 的消息 ID 列表

    console.log('Setting up message subscriptions for chat:', chat?.uid);

    (async () => {
      if (!chat?.uid) {
        return
      }
      const range = await getChatViewport(chat.uid)
      const messages = await getRange(chat.uid, range
        ? {
            from: range.firstVisibleSeq,
            to: range.lastVisibleSeq,
          }
        : undefined)

      setMessages(messages)
    })()

    if (!chat?.uid) {
      return
    }

    // 2. 实时更新订阅
    const handleCreated = (payload: { chatUid: string, message: Message }) => {
      if (payload.chatUid === chat.uid) {
        setMessages(prev => [...prev, payload.message])
      }
    }

    const handleStreaming = (payload: { messageUid: string, content: string }) => {
      setMessages(prev => prev.map(msg =>
        msg.uid === payload.messageUid
          ? { ...msg, content: payload.content, status: 'streaming' }
          : msg,
      ))
    }

    const handleUpdated = (payload: { messageUid: string, updates: Partial<Message> }) => {
      setMessages(prev => prev.map(msg =>
        msg.uid === payload.messageUid
          ? { ...msg, ...payload.updates }
          : msg,
      ))
    }

    const unsubCreated = onUpdate('message.created', handleCreated)
    const unsubStreaming = onUpdate('message.streaming', handleStreaming)
    const unsubUpdated = onUpdate('message.updated', handleUpdated)

    return () => {
      unsubCreated?.()
      unsubStreaming?.()
      unsubUpdated?.()
    }
  }, [chat?.uid])

  return (
    <main ref={wrapperRef} className="h-(--app-chat-content-height)">
      <VList
        ref={vListRef}
        style={{
          height: 'var(--app-chat-content-height)',
        }}
        onScroll={(offset) => {
          setOffset(offset)
          if (offset === 0) {
            setIsTop(true)
          }
          else {
            setIsTop(false)
          }
        }}
      >
        {
          messages.map((message, index) => (
            <MessageItem key={message.uid} message={message} index={index} />
          ))
        }
      </VList>
    </main>
  )
})
