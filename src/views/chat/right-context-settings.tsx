import type { ChatContextSettings } from '@/node/database/schema/chat'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useChatContext } from '@/context/chat'
import { getConfig } from '@/lib/config'
import { trpcClient } from '@/lib/trpc-client'
import { DEFAULT_CHAT_CONTEXT_SETTINGS } from '@/node/database/schema/chat'

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
  }
}

export default function RightContextSettings() {
  const { chat } = useChatContext()
  const [maxMessages, setMaxMessages] = useState(String(DEFAULT_CHAT_CONTEXT_SETTINGS.maxMessages))
  const [timeWindow, setTimeWindow] = useState(
    DEFAULT_CHAT_CONTEXT_SETTINGS.timeWindowHours ? String(DEFAULT_CHAT_CONTEXT_SETTINGS.timeWindowHours) : 'none',
  )
  const [isSaving, setIsSaving] = useState(false)
  const [allSkills, setAllSkills] = useState<Array<{ name: string, description: string }>>([])
  const [globalDisabledSkills, setGlobalDisabledSkills] = useState<string[]>([])
  const [chatDisabledSkills, setChatDisabledSkills] = useState<string[]>([])
  const [chatEnabledSkills, setChatEnabledSkills] = useState<string[]>([])

  useEffect(() => {
    if (!chat?.uid)
      return

    Promise.all([
      trpcClient.skill.list(),
      getConfig(),
      trpcClient.chat.getSkillSettings({ chatUid: chat.uid }),
    ]).then(([skills, config, chatSettings]) => {
      setAllSkills(skills.map(skill => ({ name: skill.name, description: skill.description })))
      setGlobalDisabledSkills(config.disabledSkills ?? [])
      setChatDisabledSkills(chatSettings.disabledSkills ?? [])
      setChatEnabledSkills(chatSettings.enabledSkills ?? [])
    }).catch(() => {
      toast.error('加载技能设置失败')
    })
  }, [chat?.uid])

  const initialSettings = useMemo(() => normalizeSettings(chat?.contextSettings), [chat?.contextSettings])

  useEffect(() => {
    setMaxMessages(String(initialSettings.maxMessages))
    setTimeWindow(initialSettings.timeWindowHours ? String(initialSettings.timeWindowHours) : 'none')
  }, [initialSettings])

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

  return (
    <div className="space-y-4 p-1">
      <div className="rounded-lg border p-3 space-y-1">
        <h3 className="text-sm font-medium">上下文构建规则</h3>
        <p className="text-xs text-muted-foreground">
          控制每次提问时，自动加入历史上下文的消息范围。
        </p>
      </div>

      <div className="rounded-lg border p-3 space-y-3">
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

        <Button className="w-full" onClick={handleSave} disabled={isSaving}>
          {isSaving ? '保存中...' : '保存设置'}
        </Button>
      </div>

      <div className="rounded-lg border p-3 space-y-3">
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
