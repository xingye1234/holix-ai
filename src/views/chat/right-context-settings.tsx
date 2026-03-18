import type { ChatContextSettings } from '@/node/database/schema/chat'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useChatContext } from '@/context/chat'
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
      await trpcClient.chat.updateContextSettings({
        chatUid: chat.uid,
        contextSettings: settings,
      })
      toast.success('上下文设置已保存')
    }
    catch {
      toast.error('上下文设置保存失败')
    }
    finally {
      setIsSaving(false)
    }
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
    </div>
  )
}
