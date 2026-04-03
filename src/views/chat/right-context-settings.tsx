import type { ChatContextSettings } from '@/node/database/schema/chat'
import { CalendarClock, Trash2 } from 'lucide-react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Field, FieldContent, FieldDescription, FieldGroup, FieldTitle } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useChatContext } from '@/context/chat'
import { getConfig } from '@/lib/config'
import { trpcClient } from '@/lib/trpc-client'
import { DEFAULT_CHAT_CONTEXT_SETTINGS } from '@/node/database/schema/chat'
import useChat from '@/store/chat'

const TIME_WINDOW_OPTIONS: Array<{ label: string, value: string }> = [
  { label: '不限时间', value: 'none' },
  { label: '最近 1 小时', value: '1' },
  { label: '最近 6 小时', value: '6' },
  { label: '最近 24 小时', value: '24' },
  { label: '最近 3 天', value: '72' },
  { label: '最近 7 天', value: '168' },
]

function normalizeSettings(settings?: ChatContextSettings | null): ChatContextSettings {
  return {
    maxMessages: settings?.maxMessages ?? DEFAULT_CHAT_CONTEXT_SETTINGS.maxMessages,
    timeWindowHours: settings?.timeWindowHours ?? DEFAULT_CHAT_CONTEXT_SETTINGS.timeWindowHours,
    autoScrollToBottomOnSend: settings?.autoScrollToBottomOnSend ?? DEFAULT_CHAT_CONTEXT_SETTINGS.autoScrollToBottomOnSend,
  }
}

function formatTimeValue(date: Date) {
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${hours}:${minutes}`
}

function formatExpiresLabel(expiresAt: number | null | undefined) {
  if (!expiresAt)
    return '永不过期'

  const date = new Date(expiresAt)
  return `${date.toLocaleDateString()} ${formatTimeValue(date)}`
}

export default function RightContextSettings() {
  const { chat } = useChatContext()
  const navigate = useNavigate()
  const location = useRouterState({ select: s => s.location.pathname })
  const chats = useChat(state => state.chats)
  const removeChat = useChat(state => state.removeChat)
  const updateChat = useChat(state => state.updateChat)
  const [maxMessages, setMaxMessages] = useState(String(DEFAULT_CHAT_CONTEXT_SETTINGS.maxMessages))
  const [timeWindow, setTimeWindow] = useState(
    DEFAULT_CHAT_CONTEXT_SETTINGS.timeWindowHours ? String(DEFAULT_CHAT_CONTEXT_SETTINGS.timeWindowHours) : 'none',
  )
  const [autoScrollToBottomOnSend, setAutoScrollToBottomOnSend] = useState(
    DEFAULT_CHAT_CONTEXT_SETTINGS.autoScrollToBottomOnSend,
  )
  const [isSaving, setIsSaving] = useState(false)
  const [allSkills, setAllSkills] = useState<Array<{ name: string, description: string }>>([])
  const [globalDisabledSkills, setGlobalDisabledSkills] = useState<string[]>([])
  const [chatDisabledSkills, setChatDisabledSkills] = useState<string[]>([])
  const [chatEnabledSkills, setChatEnabledSkills] = useState<string[]>([])
  const [chatTitle, setChatTitle] = useState('')
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedTime, setSelectedTime] = useState('23:59')
  const [isExpiryEditorOpen, setIsExpiryEditorOpen] = useState(false)

  useEffect(() => {
    if (!chat?.uid) {
      setAllSkills([])
      setGlobalDisabledSkills([])
      setChatDisabledSkills([])
      setChatEnabledSkills([])
      return
    }

    let cancelled = false

    Promise.all([
      trpcClient.skill.list(),
      getConfig(),
      trpcClient.chat.getSkillSettings({ chatUid: chat.uid }),
    ]).then(([skills, config, chatSettings]) => {
      if (cancelled) {
        return
      }
      setAllSkills(skills.map(skill => ({ name: skill.name, description: skill.description })))
      setGlobalDisabledSkills(config.disabledSkills ?? [])
      setChatDisabledSkills(chatSettings.disabledSkills ?? [])
      setChatEnabledSkills(chatSettings.enabledSkills ?? [])
    }).catch(() => {
      if (!cancelled) {
        toast.error('加载技能设置失败')
      }
    })

    return () => {
      cancelled = true
    }
  }, [chat?.uid])

  const initialSettings = useMemo(() => normalizeSettings(chat?.contextSettings), [chat?.contextSettings])
  const expiresLabel = useMemo(() => formatExpiresLabel(chat?.expiresAt), [chat?.expiresAt])
  const isTitleDirty = chatTitle.trim().length > 0 && chatTitle.trim() !== (chat?.title ?? '')

  useEffect(() => {
    setMaxMessages(String(initialSettings.maxMessages))
    setTimeWindow(initialSettings.timeWindowHours ? String(initialSettings.timeWindowHours) : 'none')
    setAutoScrollToBottomOnSend(initialSettings.autoScrollToBottomOnSend)
  }, [initialSettings])

  useEffect(() => {
    setChatTitle(chat?.title ?? '')
    if (chat?.expiresAt) {
      const date = new Date(chat.expiresAt)
      setSelectedDate(date)
      setSelectedTime(formatTimeValue(date))
      return
    }
    setSelectedDate(undefined)
    setSelectedTime('23:59')
  }, [chat?.title, chat?.expiresAt])

  const handleSave = async () => {
    if (!chat) {
      return
    }

    const parsedMaxMessages = Number(maxMessages)
    if (!Number.isInteger(parsedMaxMessages) || parsedMaxMessages <= 0 || parsedMaxMessages > 200) {
      toast.error('消息数量需为 1~200 的整数')
      return
    }

    const settings: ChatContextSettings = {
      maxMessages: parsedMaxMessages,
      timeWindowHours: timeWindow === 'none' ? null : Number(timeWindow),
      autoScrollToBottomOnSend,
    }

    try {
      setIsSaving(true)
      await Promise.all([
        trpcClient.chat.updateContextSettings({
          chatUid: chat.uid,
          contextSettings: settings,
        }),
        trpcClient.chat.updateSkillSettings({
          chatUid: chat.uid,
          disabledSkills: chatDisabledSkills,
          enabledSkills: chatEnabledSkills,
        }),
      ])
      toast.success('上下文与技能设置已保存')
    }
    catch {
      toast.error('上下文设置保存失败')
    }
    finally {
      setIsSaving(false)
    }
  }

  const getSkillStatus = (skillName: string) => {
    if (chatEnabledSkills.includes(skillName)) {
      return { disabled: false, source: '会话强制启用' }
    }
    if (chatDisabledSkills.includes(skillName)) {
      return { disabled: true, source: '会话强制禁用' }
    }
    if (globalDisabledSkills.includes(skillName)) {
      return { disabled: true, source: '全局禁用' }
    }
    return { disabled: false, source: '跟随全局' }
  }

  const toggleSkill = (skillName: string, disabled: boolean) => {
    if (disabled) {
      setChatEnabledSkills(prev => prev.filter(name => name !== skillName))
      setChatDisabledSkills(prev => Array.from(new Set([...prev, skillName])))
      return
    }

    if (globalDisabledSkills.includes(skillName)) {
      setChatDisabledSkills(prev => prev.filter(name => name !== skillName))
      setChatEnabledSkills(prev => Array.from(new Set([...prev, skillName])))
      return
    }

    setChatDisabledSkills(prev => prev.filter(name => name !== skillName))
    setChatEnabledSkills(prev => prev.filter(name => name !== skillName))
  }

  const handleRenameChat = async () => {
    if (!chat)
      return

    const nextTitle = chatTitle.trim()
    if (!nextTitle || nextTitle === chat.title)
      return

    try {
      await trpcClient.chat.update({
        uid: chat.uid,
        title: nextTitle,
      })
      updateChat(chat.uid, { title: nextTitle })
      toast.success('会话名称已更新')
    }
    catch {
      toast.error('重命名会话失败')
    }
  }

  const handleSaveExpiry = async () => {
    if (!chat)
      return

    let expiresAt: number | null = null
    if (selectedDate) {
      const [hours, minutes] = selectedTime.split(':').map(part => Number.parseInt(part, 10))
      const date = new Date(selectedDate)
      date.setHours(Number.isNaN(hours) ? 23 : hours, Number.isNaN(minutes) ? 59 : minutes, 0, 0)
      expiresAt = date.getTime()
    }

    try {
      await trpcClient.chat.update({
        uid: chat.uid,
        expiresAt,
      })
      updateChat(chat.uid, { expiresAt })
      toast.success('会话过期时间已更新')
    }
    catch {
      toast.error('更新会话过期时间失败')
    }
  }

  const handleDeleteChat = async () => {
    if (!chat)
      return

    const isActive = location === `/chat/${chat.uid}`
    if (isActive) {
      const idx = chats.findIndex(c => c.uid === chat.uid)
      const target = chats[idx - 1] ?? chats[idx + 1]
      await navigate({ to: target ? `/chat/${target.uid}` : '/' })
    }

    await removeChat(chat.uid)
  }

  return (
    <div className="space-y-4 p-1">
      <div className="rounded-xl border bg-card/70 p-4 shadow-sm space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-medium">会话管理</h3>
          <p className="text-xs text-muted-foreground">
            调整当前会话的名称和过期策略，重要操作也统一放在这里。
          </p>
        </div>

        <FieldGroup className="gap-3">
          <Field className="rounded-lg border bg-background/80 p-3">
            <FieldContent className="gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <FieldTitle>会话名称</FieldTitle>
                  <FieldDescription className="text-xs">
                    用一个更清晰的标题，方便在左侧列表里快速回到这个会话。
                  </FieldDescription>
                </div>
                <Button onClick={handleRenameChat} disabled={!chat || !isTitleDirty}>
                  保存名称
                </Button>
              </div>
              <Input
                id="chat-title"
                aria-label="会话名称"
                value={chatTitle}
                onChange={e => setChatTitle(e.target.value)}
                placeholder="输入新的会话名称"
                className="bg-background"
              />
            </FieldContent>
          </Field>

          <Field className="rounded-lg border bg-background/80 p-3">
            <FieldContent className="gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <FieldTitle>过期时间</FieldTitle>
                  <FieldDescription className="text-xs">
                    当前：
                    {' '}
                    {expiresLabel}
                  </FieldDescription>
                </div>
                <Popover open={isExpiryEditorOpen} onOpenChange={setIsExpiryEditorOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline">
                      <CalendarClock className="size-4" />
                      调整时间
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-auto space-y-3 p-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">设置过期时间</p>
                      <p className="text-xs text-muted-foreground">
                        可选择具体日期和时间，或者保持为永不过期。
                      </p>
                    </div>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      className="rounded-md border"
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={selectedTime}
                        onChange={e => setSelectedTime(e.target.value)}
                        disabled={!selectedDate}
                        className="w-34"
                      />
                      <Button variant="outline" size="sm" onClick={() => setSelectedDate(undefined)}>
                        永不过期
                      </Button>
                      <Button
                        size="sm"
                        onClick={async () => {
                          await handleSaveExpiry()
                          setIsExpiryEditorOpen(false)
                        }}
                        disabled={!chat}
                      >
                        保存
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <Item variant="muted" size="sm" className="rounded-lg">
                <ItemContent>
                  <ItemTitle className="gap-2">
                    <CalendarClock className="size-4 text-muted-foreground" />
                    {expiresLabel}
                  </ItemTitle>
                  <ItemDescription>
                    过期后会话会按照当前策略自动失效；如果你不设置，它会一直保留。
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  {chat?.expiresAt
                    ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            setSelectedDate(undefined)
                            setSelectedTime('23:59')
                            await handleSaveExpiry()
                          }}
                        >
                          清除
                        </Button>
                      )
                    : null}
                </ItemActions>
              </Item>
            </FieldContent>
          </Field>
        </FieldGroup>

        <div className="border-t pt-4">
          <Item variant="muted" className="rounded-lg border-destructive/20 bg-destructive/5">
            <ItemContent>
              <ItemTitle className="gap-2 text-destructive">
                <Trash2 className="size-4" />
                删除当前会话
              </ItemTitle>
              <ItemDescription className="text-xs">
                会同时删除会话里的全部消息和关联状态，这个操作无法撤销。
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={!chat}>
                    删除
                  </Button>
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
                    <AlertDialogAction onClick={handleDeleteChat}>继续删除</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </ItemActions>
          </Item>
        </div>
      </div>

      <div className="rounded-xl border bg-card/70 p-4 space-y-1 shadow-sm">
        <h3 className="text-sm font-medium">上下文构建规则</h3>
        <p className="text-xs text-muted-foreground">
          控制每次提问时，自动加入历史上下文的消息范围。
        </p>
      </div>

      <div className="rounded-xl border bg-card/70 p-4 space-y-3 shadow-sm">
        <div className="space-y-2">
          <Label htmlFor="context-max-messages">上下文消息数量</Label>
          <Input
            id="context-max-messages"
            type="number"
            min={1}
            max={200}
            value={maxMessages}
            onChange={e => setMaxMessages(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">每次请求最多读取最近 N 条消息（1~200）。</p>
        </div>

        <div className="space-y-2">
          <Label>上下文时间窗口</Label>
          <Select value={timeWindow} onValueChange={setTimeWindow}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_WINDOW_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">仅纳入时间窗口内的消息；可设置为不限时间。</p>
        </div>

        <div className="flex items-start justify-between gap-3 rounded-md border p-3">
          <div className="space-y-1">
            <Label htmlFor="auto-scroll-to-bottom">发送后自动滚动到底部</Label>
            <p className="text-xs text-muted-foreground">
              发送新消息后，聊天列表会自动滚动到最底部，便于继续查看最新回复。
            </p>
          </div>
          <Switch
            id="auto-scroll-to-bottom"
            checked={autoScrollToBottomOnSend}
            onCheckedChange={setAutoScrollToBottomOnSend}
          />
        </div>

        <Button className="w-full" onClick={handleSave} disabled={isSaving}>
          {isSaving ? '保存中...' : '保存设置'}
        </Button>
      </div>

      <div className="rounded-xl border bg-card/70 p-4 space-y-3 shadow-sm">
        <h3 className="text-sm font-medium">会话 Skills 开关（优先级高于全局）</h3>
        <p className="text-xs text-muted-foreground">你可以在当前会话覆盖 Skills 页面中的全局启用状态。</p>

        <div className="space-y-2 max-h-80 overflow-auto pr-1">
          {allSkills.map((skill) => {
            const status = getSkillStatus(skill.name)
            return (
              <div key={skill.name} className="flex items-start justify-between gap-3 rounded-md border p-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{skill.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{skill.description}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    来源：
                    {status.source}
                  </p>
                </div>
                <Switch checked={status.disabled} onCheckedChange={checked => toggleSkill(skill.name, checked)} />
              </div>
            )
          })}
          {allSkills.length === 0 && <p className="text-xs text-muted-foreground">暂无可配置 Skills</p>}
        </div>
      </div>
    </div>
  )
}
