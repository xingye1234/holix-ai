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
import { useI18n } from '@/i18n/provider'
import { CODE_THEME_PRESETS } from '@/lib/theme-system'
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
  const { locale, setLocale, t } = useI18n()
  const { theme, codeTheme, setTheme, setCodeTheme } = useTheme()
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
        <h1 className="text-2xl font-bold">{t('settings.general.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('settings.general.subtitle')}</p>
      </div>

      <div className="max-w-2xl space-y-6">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t('settings.general.appearance')}</h2>

          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">{t('settings.general.appTheme')}</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('settings.general.appThemeDesc')}
                </p>
              </div>
              <Select value={theme} onValueChange={v => setTheme(v as 'light' | 'dark' | 'system')}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t('settings.general.light')}</SelectItem>
                  <SelectItem value="dark">{t('settings.general.dark')}</SelectItem>
                  <SelectItem value="system">{t('settings.general.system')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-base">{t('settings.general.codeTheme')}</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('settings.general.codeThemeDesc')}
                  </p>
                </div>
                <Select value={codeTheme} onValueChange={v => setCodeTheme(v as typeof codeTheme)}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CODE_THEME_PRESETS.map(preset => (
                      <SelectItem key={preset.id} value={preset.id}>
                        {t(preset.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                {CODE_THEME_PRESETS.map((preset) => {
                  const selected = preset.id === codeTheme
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setCodeTheme(preset.id)}
                      className={`rounded-xl border p-3 text-left transition-colors ${selected ? 'border-primary bg-primary/5' : 'border-border bg-background hover:bg-accent/40'}`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-medium">{t(preset.labelKey)}</p>
                        <span className={`size-2.5 rounded-full ${selected ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                      </div>
                      <div className="mb-2 overflow-hidden rounded-md border">
                        <div className="bg-[#f6f8fa] px-2 py-1 text-[11px] text-[#57606a]">
                          const theme = &quot;
                          {t(preset.labelKey)}
                          &quot;
                        </div>
                        <div className="bg-[#0d1117] px-2 py-1.5 text-[11px] text-[#c9d1d9]">
                          <span className="text-[#ff7b72]">console</span>
                          <span className="text-[#c9d1d9]">.</span>
                          <span className="text-[#d2a8ff]">log</span>
                          <span className="text-[#c9d1d9]">(</span>
                          <span className="text-[#a5d6ff]">theme</span>
                          <span className="text-[#c9d1d9]">)</span>
                        </div>
                      </div>
                      <p className="text-xs leading-5 text-muted-foreground">
                        {t(preset.descriptionKey)}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">{t('settings.general.language')}</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('settings.general.languageDesc')}
                </p>
              </div>
              <Select value={locale} onValueChange={v => setLocale(v as 'zh-CN' | 'en-US')}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zh-CN">简体中文</SelectItem>
                  <SelectItem value="en-US">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t('settings.general.startup')}</h2>

          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">{t('settings.general.autoStart')}</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('settings.general.autoStartDesc')}
                </p>
              </div>
              <Switch checked={autoStart} onCheckedChange={handleAutoStartChange} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">{t('settings.general.minimizeToTray')}</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('settings.general.minimizeToTrayDesc')}
                </p>
              </div>
              <Switch
                checked={minimizeToTray}
                onCheckedChange={handleMinimizeToTrayChange}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">{t('settings.general.closeToTray')}</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('settings.general.closeToTrayDesc')}
                </p>
              </div>
              <Switch checked={closeToTray} onCheckedChange={handleCloseToTrayChange} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t('settings.general.context7')}</h2>
          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex flex-col gap-2">
              <Label className="text-base">{t('settings.general.context7ApiKey')}</Label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="border rounded px-3 py-2 text-sm flex-1"
                  placeholder={t('settings.general.context7ApiKeyPlaceholder')}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                />
                <Button variant="outline" size="sm" onClick={handleSaveApiKey}>
                  {t('common.save')}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('settings.general.context7ApiKeyDesc')}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t('settings.general.notifications')}</h2>

          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">{t('settings.general.showNotifications')}</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('settings.general.showNotificationsDesc')}
                </p>
              </div>
              <Switch
                checked={showNotifications}
                onCheckedChange={setShowNotifications}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t('settings.general.dataStorage')}</h2>

          <div className="rounded-lg border p-4 space-y-4">
            <div>
              <Label className="text-base">{t('settings.general.clearCache')}</Label>
              <p className="text-sm text-muted-foreground mt-1 mb-3">
                {t('settings.general.clearCacheDesc')}
              </p>
              <Button variant="outline" size="sm">
                {t('settings.general.clearCache')}
              </Button>
            </div>

            <div className="border-t pt-4">
              <Label className="text-base text-destructive">{t('settings.general.resetApp')}</Label>
              <p className="text-sm text-muted-foreground mt-1 mb-3">
                {t('settings.general.resetAppDesc')}
              </p>
              <Button variant="destructive" size="sm">
                {t('settings.general.resetSettings')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
