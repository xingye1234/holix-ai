import type { Chat } from '@/node/database/schema/chat'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useCallback } from 'react'
import { timeAgo } from '@/lib/time'
import useChat from '@/store/chat'
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'

export function ChatPanel(props: Chat) {
  const navigate = useNavigate()
  const location = useRouterState({ select: s => s.location.pathname })
  const chats = useChat(state => state.chats)
  const removeChat = useChat(state => state.removeChat)

  const onDelete = useCallback(
    async () => {
      // 仅当前正在查看被删会话时才需要跳转
      const isActive = location === `/chat/${props.uid}`
      if (isActive) {
        const idx = chats.findIndex(c => c.uid === props.uid)
        // 优先跳前一个，没有则跳后一个，都没有则回首页
        const target = chats[idx - 1] ?? chats[idx + 1]
        await navigate({ to: target ? `/chat/${target.uid}` : '/' })
      }
      removeChat(props.uid)
    },
    [props.uid, location, chats, navigate, removeChat],
  )

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        aria-label={`Open chat: ${props.title}`}
        asChild
        isActive={location === `/chat/${props.uid}`}
      >
        <Link to="/chat/$id" params={{ id: props.uid }}>
          <div className="flex w-full items-center justify-between gap-2 min-w-0">
            <span className="font-medium truncate text-sm">{props.title}</span>
            <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(props.updatedAt)}</span>
          </div>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
