import { createFileRoute } from '@tanstack/react-router'
import { AnimatePresence } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
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

  useEffect(() => {
    updateConfig('currentChatId', id)
  }, [id])

  // 使用 useMemo 优化 Context value，避免不必要的重渲染
  // 配合 immer 和 shallow selector，chat 对象引用只在真正变化时更新
  const contextValue = useMemo(
    () => ({ chat: chat || null, chatId: id }),
    [chat, id],
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
