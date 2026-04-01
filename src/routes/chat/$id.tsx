import type { Message, PendingMessage } from '@/node/database/schema/chat'
import { createFileRoute } from '@tanstack/react-router'
import { AnimatePresence } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { SelectionToolbar } from '@/components/message-selection'
import { ChatContext } from '@/context/chat'
import { useSettingsPanel } from '@/context/settings-panel'
import { useMessageShortcuts } from '@/hooks/use-message-shortcuts'
import { updateConfig } from '@/lib/config'
import useChat from '@/store/chat'
import { useMessageStore } from '@/store/message'
import ChatPanel from '@/views/chat/right-panel'
import { MainContent } from '@/views/main/content'
import MainFooter from '@/views/main/footer'

export const Route = createFileRoute('/chat/$id')({
  component: Component,
})

function Component() {
  const { id } = Route.useParams()
  // ✅ 配合 immer 优化，chat 对象引用只在真正变化时才更新
  const chat = useChat(state => state.chats.find(chat => chat.uid === id))
  const deleteMessages = useMessageStore(state => state.deleteMessages)
  const { isOpen: isSettingsPanelOpen } = useSettingsPanel()

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
    [chat, id, isAtBottom],
  )

  // 处理批量删除选中的消息
  const handleDeleteSelected = useCallback(
    async (messageIds: string[]) => {
      if (!chat)
        return 0

      try {
        const deletedCount = await deleteMessages(chat.uid, messageIds)
        if (deletedCount === 0) {
          toast.error('删除消息失败')
        }
        return deletedCount
      }
      catch (error) {
        console.error('Failed to delete messages:', error)
        toast.error('删除消息失败')
        return 0
      }
    },
    [chat, deleteMessages],
  )

  // 获取当前聊天的所有消息ID
  const messages = useMessageStore(state => state.messages)
  const messageIds = useMemo(() => Object.values(messages).map((m: Message) => m.uid), [messages])

  // 启用键盘快捷键
  useMessageShortcuts({ messageIds })

  return (
    <ChatContext.Provider value={contextValue}>
      <div className="flex h-full w-full">
        {/* Main Chat Area */}
        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <SelectionToolbar
            onDeleteSelected={handleDeleteSelected}
          />
          <MainContent />
          <MainFooter />
        </div>

        <AnimatePresence>{isSettingsPanelOpen && <ChatPanel />}</AnimatePresence>
      </div>
    </ChatContext.Provider>
  )
}
