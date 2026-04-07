import { createFileRoute } from '@tanstack/react-router'
import { LoaderCircle, Search } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { discoverProviderModels } from '@/lib/provider'
import { CODE_THEME_PRESETS } from '@/lib/theme-system'
import { getConfig, updateConfig } from '@/lib/config'
import { buildOllamaBaseUrl } from '@/node/platform/ollama'

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
  const [ollamaEnabled, setOllamaEnabled] = useState(config.ollama?.enabled ?? false)
  const [ollamaHost, setOllamaHost] = useState(config.ollama?.host ?? 'localhost')
  const [ollamaPort, setOllamaPort] = useState(config.ollama?.port ?? '11434')
  const [ollamaApiKey, setOllamaApiKey] = useState(config.ollama?.apiKey ?? '')
  const [ollamaModels, setOllamaModels] = useState(config.ollama?.models ?? [])
  const [ollamaStatus, setOllamaStatus] = useState('')
  const [isDiscoveringOllama, setIsDiscoveringOllama] = useState(false)
  const ollamaConfigSignatureRef = useRef(JSON.stringify(config.ollama ?? null))
  const ollamaAutoSaveReadyRef = useRef(false)

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

  const persistOllamaSettings = useCallback(async (trigger: 'auto' | 'manual') => {
    const nextConfig = {
      enabled: ollamaEnabled,
      host: ollamaHost.trim() || 'localhost',
      port: ollamaPort.trim() || '11434',
      apiKey: ollamaApiKey.trim(),
      models: ollamaModels,
    }

    await updateConfig('ollama', nextConfig)

    if (!nextConfig.enabled) {
      setOllamaStatus(t('settings.general.ollamaDisabledStatus'))
      return
    }

    setIsDiscoveringOllama(true)
    setOllamaStatus(t('settings.general.ollamaDetectingStatus'))

    try {
      const result = await discoverProviderModels({
        apiType: 'ollama',
        baseUrl: buildOllamaBaseUrl(nextConfig.host, nextConfig.port),
        apiKey: nextConfig.apiKey,
      })

      setOllamaModels(result.models)
      setOllamaStatus(t('settings.general.ollamaReadyStatus', { count: result.models.length }))

      await updateConfig('ollama', {
        ...nextConfig,
        models: result.models,
      })

      if (trigger === 'manual') {
        toast.success(t('settings.provider.toast.ollamaDetectSuccess', { count: result.models.length }))
      }
    }
    catch (error) {
      setOllamaStatus(t('settings.general.ollamaErrorStatus', { message: (error as Error).message }))
      await updateConfig('ollama', {
        ...nextConfig,
        models: [],
      })
      setOllamaModels([])

      if (trigger === 'manual') {
        toast.error(t('settings.provider.toast.ollamaDetectError', { message: (error as Error).message }))
      }
    }
    finally {
      setIsDiscoveringOllama(false)
    }
  }, [ollamaApiKey, ollamaEnabled, ollamaHost, ollamaModels, ollamaPort, t])

  useEffect(() => {
    if (!ollamaAutoSaveReadyRef.current) {
      ollamaAutoSaveReadyRef.current = true
      return
    }

    const signature = JSON.stringify({
      enabled: ollamaEnabled,
      host: ollamaHost.trim(),
      port: ollamaPort.trim(),
      apiKey: ollamaApiKey.trim(),
    })

    if (signature === ollamaConfigSignatureRef.current) {
      return
    }

    const timeout = window.setTimeout(() => {
      ollamaConfigSignatureRef.current = signature
      void persistOllamaSettings('auto')
    }, 700)

    return () => window.clearTimeout(timeout)
  }, [ollamaApiKey, ollamaEnabled, ollamaHost, ollamaPort, persistOllamaSettings])

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
          <h2 className="text-lg font-semibold">{t('settings.general.ollama')}</h2>
          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-base">{t('settings.general.ollamaEnabled')}</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('settings.general.ollamaEnabledDesc')}
                </p>
              </div>
              <Switch checked={ollamaEnabled} onCheckedChange={setOllamaEnabled} />
            </div>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
              <div className="space-y-2">
                <Label className="text-base">{t('settings.general.ollamaHost')}</Label>
                <Input
                  value={ollamaHost}
                  onChange={e => setOllamaHost(e.target.value)}
                  placeholder={t('settings.general.ollamaHostPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-base">{t('settings.general.ollamaPort')}</Label>
                <Input
                  value={ollamaPort}
                  onChange={e => setOllamaPort(e.target.value)}
                  placeholder={t('settings.general.ollamaPortPlaceholder')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-base">{t('settings.general.ollamaApiKey')}</Label>
              <Input
                type="password"
                value={ollamaApiKey}
                onChange={e => setOllamaApiKey(e.target.value)}
                placeholder={t('settings.general.ollamaApiKeyPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">
                {t('settings.general.ollamaApiKeyDesc')}
              </p>
            </div>

            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-base">{t('settings.general.ollamaDetectedModels')}</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('settings.general.ollamaEndpoint', { url: buildOllamaBaseUrl(ollamaHost, ollamaPort) })}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isDiscoveringOllama || !ollamaEnabled}
                  onClick={() => void persistOllamaSettings('manual')}
                >
                  {isDiscoveringOllama
                    ? <LoaderCircle className="mr-2 size-4 animate-spin" />
                    : <Search className="mr-2 size-4" />}
                  {t('settings.general.ollamaRefresh')}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                {ollamaStatus || t('settings.general.ollamaIdleStatus')}
              </p>

              <div className="flex flex-wrap gap-2">
                {ollamaModels.length > 0
                  ? ollamaModels.map(model => (
                      <Badge key={model} variant="outline" className="font-mono text-[11px]">
                        {model}
                      </Badge>
                    ))
                  : (
                      <span className="text-xs text-muted-foreground">
                        {t('settings.general.ollamaNoModels')}
                      </span>
                    )}
              </div>
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
