import type { Chat } from '@/node/database/schema/chat'
import { Link, useRouterState } from '@tanstack/react-router'
import { timeAgo } from '@/lib/time'
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'

export function ChatPanel(props: Chat) {
  const location = useRouterState({ select: s => s.location.pathname })

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
