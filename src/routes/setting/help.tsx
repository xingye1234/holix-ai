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
          查看更新详情
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[75vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>
            更新详情
            {version && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                v
                {version}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {status === 'idle' || status === 'loading'
            ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  <RefreshCw className="mr-2 animate-spin" size={16} />
                  加载中...
                </div>
              )
            : status === 'error'
              ? (
                  <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
                    <p>加载更新说明失败，请检查网络连接。</p>
                    <Button variant="outline" size="sm" onClick={() => { setStatus('idle'); fetchNotes() }}>
                      重试
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
    toast.info(`发现新版本 ${payload.info?.version ?? ''}，开始下载...`)
  }, []))

  useUpdate('update.not-available', useCallback(() => {
    setUpdateStatus('not-available')
    toast.success('当前已是最新版本！')
  }, []))

  useUpdate('update.error', useCallback((payload) => {
    setUpdateStatus('error')
    setErrorMessage(payload.message)
    toast.error(`更新出错：${payload.message}`)
  }, []))

  useUpdate('download.progress', useCallback((payload) => {
    setUpdateStatus('downloading')
    setDownloadProgress(Math.round(payload.info.percent))
  }, []))

  useUpdate('update.downloaded', useCallback(() => {
    setUpdateStatus('downloaded')
    setDownloadProgress(100)
    toast.success('更新已下载完成，可以立即安装。')
  }, []))

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
        toast.success('开发者控制台已切换')
      })
      .catch(() => {
        toast.error('打开控制台失败')
      })
  }

  const handleOpenLink = (url: string) => {
    openExternal(url)
      .catch((error) => {
        console.error('Failed to open external link:', error)
        toast.error('打开链接失败')
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
        <h1 className="text-2xl font-bold">帮助与支持</h1>
        <p className="text-muted-foreground mt-1">应用工具和支持选项</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* 应用更新 */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">应用更新</h2>

          <div className="rounded-lg border p-4 space-y-4">
            <div>
              <Label className="text-base">检查更新</Label>
              <p className="text-sm text-muted-foreground mt-1">
                检查并获取应用的最新版本
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
                  {isChecking ? '检查中...' : '检查更新'}
                </Button>
              )}
              {isDownloaded && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleInstallUpdate}
                >
                  安装并重启
                </Button>
              )}
              {/* 查看更新详情按钮：有新版本时展示 */}
              {hasUpdate && <ReleaseNotesDialog version={updateVersion} />}

              <span className="text-sm text-muted-foreground">
                当前版本:
                {' '}
                {version}
              </span>
              {updateVersion && (
                <span className="text-sm text-primary font-medium">
                  → 新版本: v
                  {updateVersion}
                </span>
              )}
            </div>

            {(isDownloading || isDownloaded) && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{isDownloaded ? '下载完成' : '正在下载...'}</span>
                  <span>
                    {downloadProgress}
                    %
                  </span>
                </div>
                <Progress value={downloadProgress} className="h-2" />
              </div>
            )}

            {updateStatus === 'not-available' && (
              <p className="text-sm text-muted-foreground">当前已是最新版本。</p>
            )}

            {updateStatus === 'error' && errorMessage && (
              <p className="text-sm text-destructive">{errorMessage}</p>
            )}
          </div>
        </div>

        {/* 开发者工具 */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">开发者工具</h2>

          <div className="rounded-lg border p-4 space-y-4">
            <div>
              <Label className="text-base">开发者控制台</Label>
              <p className="text-sm text-muted-foreground mt-1">
                打开开发者工具用于调试和检查应用
              </p>
            </div>

            <Button variant="outline" size="sm" onClick={handleOpenDevTools}>
              <Terminal className="mr-1.5" size={16} />
              打开控制台
            </Button>
          </div>
        </div>

        <Separator />

        {/* 关于信息 */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">关于</h2>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">应用名称</span>
              <span className="text-sm font-medium">Holix AI</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">版本号</span>
              <span className="text-sm font-medium">{version}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">许可证</span>
              <span className="text-sm font-medium">MIT</span>
            </div>
          </div>
        </div>

        {/* 帮助资源 */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">帮助资源</h2>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle size={16} className="text-muted-foreground" />
                <span className="text-sm">使用文档</span>
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
                <span className="text-sm">问题反馈</span>
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
                <span className="text-sm">GitHub 仓库</span>
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
