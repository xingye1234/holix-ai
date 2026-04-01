import type { Chat } from '@/node/database/schema/chat'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Clock3, Delete, Ellipsis, Pencil } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { timeAgo } from '@/lib/time'
import { trpcClient } from '@/lib/trpc-client'
import { cn } from '@/lib/utils'
import useChat from '@/store/chat'
import { SidebarMenuAction, SidebarMenuButton } from '@/components/ui/sidebar'

function formatTimeValue(date: Date) {
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${hours}:${minutes}`
}

function formatExpiresLabel(expiresAt: number | null) {
  if (!expiresAt)
    return '永不过期'

  const date = new Date(expiresAt)
  return `${date.toLocaleDateString()} ${formatTimeValue(date)}`
}

export function ChatPanel(props: Chat) {
  const navigate = useNavigate()
  const location = useRouterState({ select: s => s.location.pathname })
  const chats = useChat(state => state.chats)
  const removeChat = useChat(state => state.removeChat)
  const updateChat = useChat(state => state.updateChat)
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [isExpiryOpen, setIsExpiryOpen] = useState(false)
  const [newTitle, setNewTitle] = useState(props.title)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => {
    if (!props.expiresAt)
      return undefined
    return new Date(props.expiresAt)
  })
  const [selectedTime, setSelectedTime] = useState(() => {
    if (!props.expiresAt)
      return '23:59'
    return formatTimeValue(new Date(props.expiresAt))
  })

  const expiresLabel = useMemo(() => formatExpiresLabel(props.expiresAt), [props.expiresAt])

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

  const onSaveExpiry = useCallback(async () => {
    let expiresAt: number | null = null

    if (selectedDate) {
      const [hours, minutes] = selectedTime.split(':').map(part => Number.parseInt(part, 10))
      const date = new Date(selectedDate)
      date.setHours(Number.isNaN(hours) ? 23 : hours, Number.isNaN(minutes) ? 59 : minutes, 0, 0)
      expiresAt = date.getTime()
    }

    try {
      await trpcClient.chat.update({
        uid: props.uid,
        expiresAt,
      })
      updateChat(props.uid, { expiresAt })
      setIsExpiryOpen(false)
    }
    catch (error) {
      console.error('Failed to update chat expiration:', error)
    }
  }, [props.uid, selectedDate, selectedTime, updateChat])

  return (
    <>
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
      <SidebarMenuAction>
        <Popover>
          <PopoverTrigger>
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

            <Dialog
              open={isExpiryOpen}
              onOpenChange={(open) => {
                setIsExpiryOpen(open)
                if (open) {
                  const current = props.expiresAt ? new Date(props.expiresAt) : undefined
                  setSelectedDate(current)
                  setSelectedTime(current ? formatTimeValue(current) : '23:59')
                }
              }}
            >
              <DialogTrigger className="w-full flex justify-between items-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md p-2 text-sm">
                <span>过期时间</span>
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <span>{expiresLabel}</span>
                  <Clock3 size={14} className="mr-2" />
                </div>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>设置会话过期时间</DialogTitle>
                </DialogHeader>
                <div className="py-2 flex flex-col gap-3">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    className="rounded-md border"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">时间</span>
                    <Input
                      type="time"
                      value={selectedTime}
                      onChange={e => setSelectedTime(e.target.value)}
                      disabled={!selectedDate}
                      className="w-36"
                    />
                    <Button variant="outline" size="sm" onClick={() => setSelectedDate(undefined)}>永不过期</Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsExpiryOpen(false)}>取消</Button>
                  <Button onClick={onSaveExpiry}>保存</Button>
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
      </SidebarMenuAction>
    </>

  )
}
