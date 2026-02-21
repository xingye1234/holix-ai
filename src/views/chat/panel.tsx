import type { Chat } from '@/node/database/schema/chat'
import { Link, useNavigate } from '@tanstack/react-router'
import { Delete, Ellipsis, Pencil } from 'lucide-react'
import { useCallback, useState } from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { timeAgo } from '@/lib/time'
import { trpcClient } from '@/lib/trpc-client'
import { cn } from '@/lib/utils'
import useChat from '@/store/chat'

export function ChatPanel(props: Chat) {
  const navigate = useNavigate()
  const removeChat = useChat(state => state.removeChat)
  const updateChat = useChat(state => state.updateChat)
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [newTitle, setNewTitle] = useState(props.title)

  const onDelete = useCallback(
    async () => {
      await navigate({ to: '/' })
      removeChat(props.uid)
    },
    [props.uid, navigate, removeChat],
  )

  const onRename = useCallback(async () => {
    if (!newTitle.trim() || newTitle === props.title) {
      setIsRenameOpen(false)
      return
    }

    try {
      await trpcClient.chat.update({
        uid: props.uid,
        title: newTitle.trim(),
      })
      updateChat(props.uid, { title: newTitle.trim() })
      setIsRenameOpen(false)
    }
    catch (error) {
      console.error('Failed to rename chat:', error)
    }
  }, [newTitle, props.title, props.uid, updateChat])

  return (
    <Link
      to="/chat/$id"
      params={{ id: props.uid }}
      className={cn(
        'flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-all select-none',
        'bg-card/30 border-border/40 hover:bg-card hover:border-border/80 hover:shadow-xs',
        'no-drag',
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
      <div onClick={e => e.preventDefault()}>
        <Popover>
          <PopoverTrigger className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer">
            <Ellipsis size={16} />
          </PopoverTrigger>
          <PopoverContent className="w-50 p-2 flex flex-col gap-1" align="start" side="bottom" onClick={e => e.stopPropagation()}>
            <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
              <DialogTrigger className="w-full flex justify-between items-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md p-2 text-sm">
                <span>重命名</span>
                <Pencil size={14} className="mr-2" />
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>重命名会话</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <Input
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="输入新的会话名称"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        onRename()
                      }
                    }}
                    autoFocus
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsRenameOpen(false)}>取消</Button>
                  <Button onClick={onRename}>保存</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

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
      </div>
    </Link>
  )
}
