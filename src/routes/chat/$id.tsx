import type { PendingMessage } from '@/node/database/schema/chat'
import { createFileRoute } from '@tanstack/react-router'
import { AnimatePresence } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChatContext } from '@/context/chat'
import { SettingsPanelProvider } from '@/context/settings-panel'
import { updateConfig } from '@/lib/config'
import useChat from '@/store/chat'
import ChatPanel from '@/views/chat/right-panel'
import { MainContent } from '@/views/main/content'
import MainFooter from '@/views/main/footer'

export const Route = createFileRoute('/chat/$id')({
  component: Component,
})

function Component() {
  const { id } = Route.useParams()
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false)
  // ✅ 配合 immer 优化，chat 对象引用只在真正变化时才更新
  const chat = useChat(state => state.chats.find(chat => chat.uid === id))

  // 消息列表底部滚动状态，供 content 更新、footer 读取
  const [isAtBottom, setIsAtBottom] = useState(true)
  const scrollToBottomRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    updateConfig('currentChatId', id)
  }, [id])

  // 使用 useMemo 优化 Context value，避免不必要的重渲染
  // 配合 immer 和 shallow selector，chat 对象引用只在真正变化时更新
  const contextValue = useMemo(
    () => {
      const pendingMessages: PendingMessage[] = chat?.pendingMessages ?? []

      return {
        chat: chat || null,
        chatId: id,
        pendingMessages,
        isAtBottom,
        setIsAtBottom,
        scrollToBottomRef,
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chat, id, isAtBottom],
  )

  const settingsPanelValue = useMemo(
    () => ({
      isOpen: isSettingsPanelOpen,
      toggle: () => setIsSettingsPanelOpen(prev => !prev),
      open: () => setIsSettingsPanelOpen(true),
      close: () => setIsSettingsPanelOpen(false),
    }),
    [isSettingsPanelOpen],
  )

  return (
    <ChatContext.Provider value={contextValue}>
      <SettingsPanelProvider value={settingsPanelValue}>
        <div className="w-full h-[calc(100vh - var(--app-header-height))] flex">
          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col">
            <MainContent />
            <MainFooter />
          </div>

          <AnimatePresence>{isSettingsPanelOpen && <ChatPanel />}</AnimatePresence>
        </div>
      </SettingsPanelProvider>
    </ChatContext.Provider>
  )
}
