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
import { useI18n } from '@/i18n/provider'
import { getConfig } from '@/lib/config'
import { trpcClient } from '@/lib/trpc-client'
import { DEFAULT_CHAT_CONTEXT_SETTINGS } from '@/node/database/schema/chat'
import useChat from '@/store/chat'

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

function formatExpiresLabel(expiresAt: number | null | undefined, neverExpiresLabel: string) {
  if (!expiresAt)
    return neverExpiresLabel

  const date = new Date(expiresAt)
  return `${date.toLocaleDateString()} ${formatTimeValue(date)}`
}

export default function RightContextSettings() {
  const { chat } = useChatContext()
  const { t } = useI18n()
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
        toast.error(t('chat.settingsPanel.skillsLoadError'))
      }
    })

    return () => {
      cancelled = true
    }
  }, [chat?.uid])

  const timeWindowOptions = useMemo(() => [
    { label: t('chat.settingsPanel.timeWindow.none'), value: 'none' },
    { label: t('chat.settingsPanel.timeWindow.lastHour'), value: '1' },
    { label: t('chat.settingsPanel.timeWindow.lastSixHours'), value: '6' },
    { label: t('chat.settingsPanel.timeWindow.lastDay'), value: '24' },
    { label: t('chat.settingsPanel.timeWindow.lastThreeDays'), value: '72' },
    { label: t('chat.settingsPanel.timeWindow.lastWeek'), value: '168' },
  ], [t])
  const initialSettings = useMemo(() => normalizeSettings(chat?.contextSettings), [chat?.contextSettings])
  const expiresLabel = useMemo(() => formatExpiresLabel(chat?.expiresAt, t('chat.settingsPanel.neverExpires')), [chat?.expiresAt, t])
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
      toast.error(t('chat.settingsPanel.maxMessagesInvalid'))
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
      toast.success(t('chat.settingsPanel.saveSuccess'))
    }
    catch {
      toast.error(t('chat.settingsPanel.saveError'))
    }
    finally {
      setIsSaving(false)
    }
  }

  const getSkillStatus = (skillName: string) => {
    if (chatEnabledSkills.includes(skillName)) {
      return { disabled: false, source: t('chat.settingsPanel.skillSource.enabledByChat') }
    }
    if (chatDisabledSkills.includes(skillName)) {
      return { disabled: true, source: t('chat.settingsPanel.skillSource.disabledByChat') }
    }
    if (globalDisabledSkills.includes(skillName)) {
      return { disabled: true, source: t('chat.settingsPanel.skillSource.disabledGlobally') }
    }
    return { disabled: false, source: t('chat.settingsPanel.skillSource.followGlobal') }
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
      toast.success(t('chat.settingsPanel.renameSuccess'))
    }
    catch {
      toast.error(t('chat.settingsPanel.renameError'))
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
      toast.success(t('chat.settingsPanel.expirySuccess'))
    }
    catch {
      toast.error(t('chat.settingsPanel.expiryError'))
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
          <h3 className="text-sm font-medium">{t('chat.settingsPanel.managementTitle')}</h3>
          <p className="text-xs text-muted-foreground">
            {t('chat.settingsPanel.managementDescription')}
          </p>
        </div>

        <FieldGroup className="gap-3">
          <Field className="rounded-lg border bg-background/80 p-3">
            <FieldContent className="gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <FieldTitle>{t('chat.settingsPanel.renameTitle')}</FieldTitle>
                  <FieldDescription className="text-xs">
                    {t('chat.settingsPanel.renameDescription')}
                  </FieldDescription>
                </div>
                <Button onClick={handleRenameChat} disabled={!chat || !isTitleDirty}>
                  {t('chat.settingsPanel.saveName')}
                </Button>
              </div>
              <Input
                id="chat-title"
                aria-label={t('chat.settingsPanel.renameTitle')}
                value={chatTitle}
                onChange={e => setChatTitle(e.target.value)}
                placeholder={t('chat.renamePlaceholder')}
                className="bg-background"
              />
            </FieldContent>
          </Field>

          <Field className="rounded-lg border bg-background/80 p-3">
            <FieldContent className="gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <FieldTitle>{t('chat.settingsPanel.expiryTitle')}</FieldTitle>
                  <FieldDescription className="text-xs">
                    {t('chat.settingsPanel.currentExpiry', { value: expiresLabel })}
                  </FieldDescription>
                </div>
                <Popover open={isExpiryEditorOpen} onOpenChange={setIsExpiryEditorOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline">
                      <CalendarClock className="size-4" />
                      {t('chat.settingsPanel.adjustExpiry')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-auto space-y-3 p-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{t('chat.settingsPanel.expiryPopoverTitle')}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('chat.settingsPanel.expiryPopoverDescription')}
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
                        {t('chat.settingsPanel.neverExpires')}
                      </Button>
                      <Button
                        size="sm"
                        onClick={async () => {
                          await handleSaveExpiry()
                          setIsExpiryEditorOpen(false)
                        }}
                        disabled={!chat}
                      >
                        {t('common.save')}
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
                    {t('chat.settingsPanel.expirySummary')}
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
                          {t('chat.settingsPanel.clearExpiry')}
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
                {t('chat.settingsPanel.deleteTitle')}
              </ItemTitle>
              <ItemDescription className="text-xs">
                {t('chat.settingsPanel.deleteDescription')}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={!chat}>
                    {t('chat.settingsPanel.deleteAction')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('chat.settingsPanel.deleteDialogTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('chat.settingsPanel.deleteDialogDescription')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteChat}>{t('chat.settingsPanel.deleteConfirm')}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </ItemActions>
          </Item>
        </div>
      </div>

      <div className="rounded-xl border bg-card/70 p-4 space-y-1 shadow-sm">
        <h3 className="text-sm font-medium">{t('chat.settingsPanel.contextRulesTitle')}</h3>
        <p className="text-xs text-muted-foreground">
          {t('chat.settingsPanel.contextRulesDescription')}
        </p>
      </div>

      <div className="rounded-xl border bg-card/70 p-4 space-y-3 shadow-sm">
        <div className="space-y-2">
          <Label htmlFor="context-max-messages">{t('chat.settingsPanel.maxMessagesLabel')}</Label>
          <Input
            id="context-max-messages"
            type="number"
            min={1}
            max={200}
            value={maxMessages}
            onChange={e => setMaxMessages(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t('chat.settingsPanel.maxMessagesHint')}</p>
        </div>

        <div className="space-y-2">
          <Label>{t('chat.settingsPanel.timeWindowLabel')}</Label>
          <Select value={timeWindow} onValueChange={setTimeWindow}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeWindowOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t('chat.settingsPanel.timeWindowHint')}</p>
        </div>

        <div className="flex items-start justify-between gap-3 rounded-md border p-3">
          <div className="space-y-1">
            <Label htmlFor="auto-scroll-to-bottom">{t('chat.settingsPanel.autoScrollLabel')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('chat.settingsPanel.autoScrollDescription')}
            </p>
          </div>
          <Switch
            id="auto-scroll-to-bottom"
            checked={autoScrollToBottomOnSend}
            onCheckedChange={setAutoScrollToBottomOnSend}
          />
        </div>

        <Button className="w-full" onClick={handleSave} disabled={isSaving}>
          {isSaving ? t('chat.settingsPanel.saving') : t('chat.settingsPanel.saveButton')}
        </Button>
      </div>

      <div className="rounded-xl border bg-card/70 p-4 space-y-3 shadow-sm">
        <h3 className="text-sm font-medium">{t('chat.settingsPanel.skillsTitle')}</h3>
        <p className="text-xs text-muted-foreground">{t('chat.settingsPanel.skillsDescription')}</p>

        <div className="space-y-2 max-h-80 overflow-auto pr-1">
          {allSkills.map((skill) => {
            const status = getSkillStatus(skill.name)
            return (
              <div key={skill.name} className="flex items-start justify-between gap-3 rounded-md border p-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{skill.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{skill.description}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t('chat.settingsPanel.skillSourceLabel')}
                    {status.source}
                  </p>
                </div>
                <Switch checked={status.disabled} onCheckedChange={checked => toggleSkill(skill.name, checked)} />
              </div>
            )
          })}
          {allSkills.length === 0 && <p className="text-xs text-muted-foreground">{t('chat.settingsPanel.skillsEmpty')}</p>}
        </div>
      </div>
    </div>
  )
}
