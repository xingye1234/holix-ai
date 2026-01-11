import type { Chat } from '@/node/database/schema/chat'
import { Link } from '@tanstack/react-router'
import { timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'

export function ChatPanel(props: Chat) {
  return (
    <Link
      to="/chat/$id"
      params={{ id: props.uid }}
      className={cn(
        'flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all select-none',
        'bg-card/30 border-border/40 hover:bg-card hover:border-border/80 hover:shadow-xs',
      )}
      activeProps={{
        className: 'bg-accent text-accent-foreground border-border shadow-sm ring-1 ring-border/50',
      }}
      aria-label={`Open chat: ${props.title}`}
    >
      <div className="flex w-full flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="font-semibold truncate max-w-[70%]">
            {props.title}
          </span>
          <span className="ml-auto text-[10px] text-muted-foreground/80">
            {timeAgo(props.updatedAt)}
          </span>
        </div>

        <span className="line-clamp-2 text-xs text-muted-foreground w-full wrap-break-word opacity-90">
          {props.lastMessagePreview || 'No messages yet'}
        </span>
      </div>
    </Link>
  )
}
