import { createFileRoute } from '@tanstack/react-router'
import { ExternalLink, FileText, HelpCircle, RefreshCw, Terminal } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { MarkdownRenderer } from '@/components/markdown/markdown-renderer'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import useUpdate from '@/hooks/update'
import { useI18n } from '@/i18n/provider'
import { checkForUpdates, getAppVersion, installUpdateAndQuit, openExternal, toggleDevTools } from '@/lib/system'

export const Route = createFileRoute('/setting/help')({
  component: RouteComponent,
})

type UpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
type NotesStatus = 'idle' | 'loading' | 'loaded' | 'error'

const RELEASE_NOTES_URL = 'https://raw.githubusercontent.com/zhaogongchengsi/holix-ai/main/RELEASE_NOTES.md'

function ReleaseNotesDialog({ version }: { version: string | null }) {
  const [status, setStatus] = useState<NotesStatus>('idle')
  const [content, setContent] = useState<string | null>(null)
  const { t } = useI18n()

  const fetchNotes = useCallback(async () => {
    if (status === 'loading' || status === 'loaded')
      return
    setStatus('loading')
    try {
      const res = await fetch(RELEASE_NOTES_URL)
      if (!res.ok)
        throw new Error(`HTTP ${res.status}`)
      setContent(await res.text())
      setStatus('loaded')
    }
    catch {
      setStatus('error')
    }
  }, [status])

  return (
    <Dialog onOpenChange={(open) => { if (open) fetchNotes() }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="mr-1.5" size={14} />
          {t('settings.help.update.viewDetails')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[75vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>
            {t('settings.help.update.detailsTitle')}
            {version && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                v{version}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {status === 'idle' || status === 'loading'
            ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  <RefreshCw className="mr-2 animate-spin" size={16} />
                  {t('settings.help.update.loading')}
                </div>
              )
            : status === 'error'
              ? (
                  <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
                    <p>{t('settings.help.update.loadError')}</p>
                    <Button variant="outline" size="sm" onClick={() => { setStatus('idle'); fetchNotes() }}>
                      {t('settings.help.update.retry')}
                    </Button>
                  </div>
                )
              : content
                ? (
                    <MarkdownRenderer content={content} />
                  )
                : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RouteComponent() {
  const [version, setVersion] = useState('加载中...')
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [updateVersion, setUpdateVersion] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { t } = useI18n()

  useEffect(() => {
    getAppVersion()
      .then((data) => {
        setVersion(`v${data.version}`)
      })
      .catch(() => {
        setVersion('获取失败')
      })
  }, [])

  useUpdate('update.checking-for-update', useCallback(() => {
    setUpdateStatus('checking')
  }, []))

  useUpdate('update.available', useCallback((payload) => {
    setUpdateStatus('available')
    setUpdateVersion(payload.info?.version ?? null)
    toast.info(t('settings.help.toast.newVersionFound', { version: payload.info?.version ?? '' }))
  }, [t]))

  useUpdate('update.not-available', useCallback(() => {
    setUpdateStatus('not-available')
    toast.success(t('settings.help.toast.upToDate'))
  }, [t]))

  useUpdate('update.error', useCallback((payload) => {
    setUpdateStatus('error')
    setErrorMessage(payload.message)
    toast.error(t('settings.help.toast.updateError', { message: payload.message }))
  }, [t]))

  useUpdate('download.progress', useCallback((payload) => {
    setUpdateStatus('downloading')
    setDownloadProgress(Math.round(payload.info.percent))
  }, []))

  useUpdate('update.downloaded', useCallback(() => {
    setUpdateStatus('downloaded')
    setDownloadProgress(100)
    toast.success(t('settings.help.toast.downloadComplete'))
  }, [t]))

  const handleCheckUpdate = useCallback(() => {
    setUpdateStatus('checking')
    setDownloadProgress(0)
    setUpdateVersion(null)
    setErrorMessage(null)
    checkForUpdates()
  }, [])

  const handleInstallUpdate = useCallback(() => {
    installUpdateAndQuit()
  }, [])

  const handleOpenDevTools = () => {
    toggleDevTools()
      .then(() => {
        toast.success(t('settings.help.toast.devToolsToggled'))
      })
      .catch(() => {
        toast.error(t('settings.help.toast.devToolsError'))
      })
  }

  const handleOpenLink = (url: string) => {
    openExternal(url)
      .catch((error) => {
        console.error('Failed to open external link:', error)
        toast.error(t('settings.help.toast.linkError'))
      })
  }

  const isChecking = updateStatus === 'checking'
  const isDownloading = updateStatus === 'downloading'
  const isDownloaded = updateStatus === 'downloaded'
  const isBusy = isChecking || updateStatus === 'available' || isDownloading
  const hasUpdate = updateVersion !== null

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('settings.help.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('settings.help.subtitle')}</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* 应用更新 */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t('settings.help.update.title')}</h2>

          <div className="rounded-lg border p-4 space-y-4">
            <div>
              <Label className="text-base">{t('settings.help.update.checkUpdate')}</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {t('settings.help.update.description')}
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {!isDownloaded && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCheckUpdate}
                  disabled={isBusy}
                >
                  <RefreshCw className={`mr-1.5 ${isChecking ? 'animate-spin' : ''}`} size={16} />
                  {isChecking ? t('settings.help.update.checking') : t('settings.help.update.checkUpdate')}
                </Button>
              )}
              {isDownloaded && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleInstallUpdate}
                >
                  {t('settings.help.update.installAndRestart')}
                </Button>
              )}
              {/* 查看更新详情按钮：有新版本时展示 */}
              {hasUpdate && <ReleaseNotesDialog version={updateVersion} />}

              <span className="text-sm text-muted-foreground">
                {t('settings.help.update.currentVersion')}
                {' '}
                {version}
              </span>
              {updateVersion && (
                <span className="text-sm text-primary font-medium">
                  {t('settings.help.update.newVersion')}
                  {updateVersion}
                </span>
              )}
            </div>

            {(isDownloading || isDownloaded) && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{isDownloaded ? t('settings.help.update.downloaded') : t('settings.help.update.downloading')}</span>
                  <span>
                    {downloadProgress}
                    %
                  </span>
                </div>
                <Progress value={downloadProgress} className="h-2" />
              </div>
            )}

            {updateStatus === 'not-available' && (
              <p className="text-sm text-muted-foreground">{t('settings.help.update.upToDate')}</p>
            )}

            {updateStatus === 'error' && errorMessage && (
              <p className="text-sm text-destructive">{errorMessage}</p>
            )}
          </div>
        </div>

        {/* 开发者工具 */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t('settings.help.devTools.title')}</h2>

          <div className="rounded-lg border p-4 space-y-4">
            <div>
              <Label className="text-base">{t('settings.help.devTools.console')}</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {t('settings.help.devTools.description')}
              </p>
            </div>

            <Button variant="outline" size="sm" onClick={handleOpenDevTools}>
              <Terminal className="mr-1.5" size={16} />
              {t('settings.help.devTools.openConsole')}
            </Button>
          </div>
        </div>

        <Separator />

        {/* 关于信息 */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t('settings.help.about.title')}</h2>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('settings.help.about.appName')}</span>
              <span className="text-sm font-medium">Holix AI</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('settings.help.about.version')}</span>
              <span className="text-sm font-medium">{version}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('settings.help.about.license')}</span>
              <span className="text-sm font-medium">MIT</span>
            </div>
          </div>
        </div>

        {/* 帮助资源 */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t('settings.help.resources.title')}</h2>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle size={16} className="text-muted-foreground" />
                <span className="text-sm">{t('settings.help.resources.docs')}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenLink('https://github.com/zhaogongchengsi/holix-ai#readme')}
              >
                <ExternalLink size={14} />
              </Button>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle size={16} className="text-muted-foreground" />
                <span className="text-sm">{t('settings.help.resources.feedback')}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenLink('https://github.com/zhaogongchengsi/holix-ai/issues')}
              >
                <ExternalLink size={14} />
              </Button>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle size={16} className="text-muted-foreground" />
                <span className="text-sm">{t('settings.help.resources.github')}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenLink('https://github.com/zhaogongchengsi/holix-ai')}
              >
                <ExternalLink size={14} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
