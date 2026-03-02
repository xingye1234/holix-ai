import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { getConfig, updateConfig } from '@/lib/config'

export const Route = createFileRoute('/setting/general')({
  component: RouteComponent,
  loader: async () => {
    const config = await getConfig()

    return { config }
  },
})

function RouteComponent() {
  const { config } = Route.useLoaderData()
  const [autoStart, setAutoStart] = useState(config.autoStart ?? false)
  const [minimizeToTray, setMinimizeToTray] = useState(config.minimizeToTray ?? true)
  const [closeToTray, setCloseToTray] = useState(config.closeToTray ?? true)
  const [showNotifications, setShowNotifications] = useState(true)
  const [language, setLanguage] = useState('zh-CN')
  const { theme, setTheme } = useTheme()
  const [apiKey, setApiKey] = useState(config.context7ApiKey ?? '')

  const handleSaveApiKey = useCallback(async () => {
    updateConfig('context7ApiKey', apiKey ?? '')
  }, [apiKey])

  const handleAutoStartChange = useCallback(async (checked: boolean) => {
    setAutoStart(checked)
    await updateConfig('autoStart', checked)
  }, [])

  const handleMinimizeToTrayChange = useCallback(async (checked: boolean) => {
    setMinimizeToTray(checked)
    await updateConfig('minimizeToTray', checked)
  }, [])

  const handleCloseToTrayChange = useCallback(async (checked: boolean) => {
    setCloseToTray(checked)
    await updateConfig('closeToTray', checked)
  }, [])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">常规设置</h1>
        <p className="text-muted-foreground mt-1">管理应用的基本设置和行为</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* 外观设置 */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">外观</h2>

          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">主题</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  选择应用的外观主题
                </p>
              </div>
              <Select value={theme} onValueChange={v => setTheme(v as 'light' | 'dark' | 'system')}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">浅色</SelectItem>
                  <SelectItem value="dark">深色</SelectItem>
                  <SelectItem value="system">跟随系统</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">语言</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  选择应用的显示语言
                </p>
              </div>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zh-CN">简体中文</SelectItem>
                  <SelectItem value="zh-TW">繁體中文</SelectItem>
                  <SelectItem value="en-US">English</SelectItem>
                  <SelectItem value="ja-JP">日本語</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* 启动设置 */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">启动与关闭</h2>

          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">开机自启动</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  系统启动时自动打开应用
                </p>
              </div>
              <Switch checked={autoStart} onCheckedChange={handleAutoStartChange} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">最小化到托盘</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  点击最小化按钮时隐藏到系统托盘
                </p>
              </div>
              <Switch
                checked={minimizeToTray}
                onCheckedChange={handleMinimizeToTrayChange}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">关闭到托盘</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  点击关闭按钮时隐藏到系统托盘而不是退出
                </p>
              </div>
              <Switch checked={closeToTray} onCheckedChange={handleCloseToTrayChange} />
            </div>
          </div>
        </div>

        {/* context7 apikey 设置 */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Context7 设置</h2>
          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex flex-col gap-2">
              <Label className="text-base">Context7 API Key</Label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="border rounded px-3 py-2 text-sm flex-1"
                  placeholder="请输入 Context7 API Key"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                />
                <Button variant="outline" size="sm" onClick={handleSaveApiKey}>
                  保存
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                用于访问 Context7 服务的 API Key，仅本地保存。
              </p>
            </div>
          </div>
        </div>

        {/* 通知设置 */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">通知</h2>

          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">显示通知</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  接收系统消息和提示通知
                </p>
              </div>
              <Switch
                checked={showNotifications}
                onCheckedChange={setShowNotifications}
              />
            </div>
          </div>
        </div>

        {/* 数据与缓存 */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">数据与存储</h2>

          <div className="rounded-lg border p-4 space-y-4">
            <div>
              <Label className="text-base">清除缓存</Label>
              <p className="text-sm text-muted-foreground mt-1 mb-3">
                清除应用缓存数据以释放磁盘空间
              </p>
              <Button variant="outline" size="sm">
                清除缓存
              </Button>
            </div>

            <div className="border-t pt-4">
              <Label className="text-base text-destructive">重置应用</Label>
              <p className="text-sm text-muted-foreground mt-1 mb-3">
                恢复所有设置到默认状态，此操作不可撤销
              </p>
              <Button variant="destructive" size="sm">
                重置设置
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
