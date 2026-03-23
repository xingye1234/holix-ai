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
    <nav className="flex min-h-0 w-full flex-1 flex-col">
      <div className="px-3 pb-2 pt-1">
        <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground/65">Threads</p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto pb-2">
        <ul className="w-full space-y-1.5">
          {filteredChats.sort((a, b) => b.updatedAt - a.updatedAt).map((chat) => {
            return (
              <li key={chat.id} className="px-2">
                <ChatPanel {...chat} />
              </li>
            )
          })}

          {chats.length === 0 && (
            <li className="px-4 py-12 flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
              <span className="text-2xl">💬</span>
              <span>还没有任何对话</span>
              <span className="text-xs opacity-60">点击上方按钮开始你的第一次对话</span>
            </li>
          )}

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
      </div>
    </nav>
  )
}
