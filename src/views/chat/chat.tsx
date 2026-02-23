import { matchSorter } from 'match-sorter'
import { useMemo } from 'react'
import useChat from '@/store/chat'
import { ChatPanel } from './panel'

export function AsideChatSidebar() {
  const chats = useChat(state => state.chats)
  const searchQuery = useChat(state => state.searchQuery)

  const filteredChats = useMemo(() => {
    if (!chats.length)
      return []

    if (!searchQuery.trim())
      return chats

    return matchSorter(chats, searchQuery, {
      keys: ['title', 'lastMessagePreview'],
      threshold: matchSorter.rankings.CONTAINS,
    })
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

        {/* 列表完全为空：从未创建过会话 */}
        {chats.length === 0 && (
          <li className="px-4 py-12 flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
            <span className="text-2xl">💬</span>
            <span>还没有任何对话</span>
            <span className="text-xs opacity-60">点击上方按钮开始你的第一次对话</span>
          </li>
        )}

        {/* 有会话但搜索无结果 */}
        {chats.length > 0 && searchQuery.trim() !== '' && filteredChats.length === 0 && (
          <li className="px-4 py-12 flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
            <span className="text-2xl">🔍</span>
            <span>
              未找到与
              {' '}
              <span className="font-medium text-foreground/70">
                "
                {searchQuery.trim()}
                "
              </span>
              {' '}
              相关的对话
            </span>
          </li>
        )}
      </ul>
    </nav>
  )
}
