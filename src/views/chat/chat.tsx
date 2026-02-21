import { useMemo } from 'react'
import useChat from '@/store/chat'
import { ChatPanel } from './panel'

export function AsideChatSidebar() {
  const chats = useChat(state => state.chats)
  const searchQuery = useChat(state => state.searchQuery)

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim())
      return chats
    const query = searchQuery.toLowerCase()
    return chats.filter(chat =>
      chat.title.toLowerCase().includes(query)
      || (chat.lastMessagePreview && chat.lastMessagePreview.toLowerCase().includes(query)),
    )
  }, [chats, searchQuery])

  return (
    <nav className="w-full py-2 h-[calc(100vh-var(--app-header-height)-50px-10px)] overflow-auto">
      <ul className="w-full space-y-2">
        {filteredChats.sort((a, b) => b.updatedAt - a.updatedAt).map((chat) => {
          return (
            <li key={chat.id} className="px-2">
              <ChatPanel {...chat} />
            </li>
          )
        })}
        {filteredChats.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">
            没有找到匹配的聊天
          </li>
        )}
      </ul>
    </nav>
  )
}
