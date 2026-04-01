import { matchSorter } from 'match-sorter'
import { useMemo } from 'react'
import useChat from '@/store/chat'
import { ChatPanel } from './panel'
import { SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem } from '@/components/ui/sidebar'

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
    <SidebarContent className="flex min-h-0 w-full">
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel>Chats</SidebarGroupLabel>
        <SidebarMenu>
          {filteredChats.sort((a, b) => b.updatedAt - a.updatedAt).map((chat) => {
            return (
              <SidebarMenuItem key={chat.id}>
                <ChatPanel {...chat} />
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>

        {chats.length === 0 && (
          <div className="px-4 py-12 flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
            <span className="text-2xl">💬</span>
            <span>还没有任何对话</span>
            <span className="text-xs opacity-60">点击上方按钮开始你的第一次对话</span>
          </div>
        )}

        {chats.length > 0 && searchQuery.trim() !== '' && filteredChats.length === 0 && (
          <div className="px-4 py-12 flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
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
          </div>
        )}
      </SidebarGroup>
    </SidebarContent>
  )
}
