import type { Chat } from '@/node/database/schema/chat'
import { Link, useNavigate } from '@tanstack/react-router'
import { Delete, Ellipsis } from 'lucide-react'
import { useCallback } from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'
import useChat from '@/store/chat'

export function ChatPanel(props: Chat) {
  const navigate = useNavigate()
  const removeChat = useChat(state => state.removeChat)

  const onDelete = useCallback(
    () => {
      navigate({ to: '/' })
      removeChat(props.uid)
    },
    [props.uid],
  )

  return (
    <Link
      to="/chat/$id"
      params={{ id: props.uid }}
      className={cn(
        'flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-all select-none',
        'bg-card/30 border-border/40 hover:bg-card hover:border-border/80 hover:shadow-xs',
      )}
      activeProps={{
        className: 'bg-accent text-accent-foreground border-border shadow-sm ring-1 ring-border/50',
      }}
      aria-label={`Open chat: ${props.title}`}
    >
      <div className="flex w-full flex-col gap-1 max-w-[90%]">
        <div className="flex items-center justify-between">
          <span className="font-semibold truncate max-w-[70%]">{props.title}</span>
          <span className="ml-auto text-[10px] text-muted-foreground/80">{timeAgo(props.updatedAt)}</span>
        </div>

        <span className="line-clamp-2 text-xs text-muted-foreground w-full wrap-break-word opacity-90">
          {props.lastMessagePreview || 'No messages yet'}
        </span>
      </div>
      <Popover>
        <PopoverTrigger>
          <Ellipsis size={16} />
        </PopoverTrigger>
        <PopoverContent className="w-50 p-2" align="start" side="bottom">
          <AlertDialog>
            <AlertDialogTrigger className="w-full flex justify-between items-center cursor-pointer text-destructive hover:text-destructive/80 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md p-2 text-sm">
              <span>删除会话</span>
              <Delete size={14} className="mr-2" />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>删除会话</AlertDialogTitle>
                <AlertDialogDescription>
                  确认要删除该会话及其所有消息吗？此操作无法撤销。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Continue</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </PopoverContent>
      </Popover>
    </Link>
  )
}
