import { createFileRoute } from '@tanstack/react-router'
import { ExternalLink, HelpCircle, RefreshCw, Terminal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { getAppVersion, openExternal, toggleDevTools } from '@/lib/system'

export const Route = createFileRoute('/setting/help')({
  component: RouteComponent,
})

function RouteComponent() {
  const [version, setVersion] = useState('加载中...')
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)

  useEffect(() => {
    getAppVersion()
      .then((data) => {
        setVersion(`v${data.version}`)
      })
      .catch(() => {
        setVersion('获取失败')
      })
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

  const handleCheckUpdate = () => {
    setIsCheckingUpdate(true)
    // TODO: 实现实际的更新检查逻辑
    setTimeout(() => {
      setIsCheckingUpdate(false)
      toast.success('当前已是最新版本！')
    }, 1500)
  }

  const handleOpenLink = (url: string) => {
    openExternal(url)
      .catch((error) => {
        console.error('Failed to open external link:', error)
        toast.error('打开链接失败')
      })
  }

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

            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={handleCheckUpdate}
                disabled={isCheckingUpdate}
              >
                <RefreshCw className={`mr-1.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} size={16} />
                {isCheckingUpdate ? '检查中...' : '检查更新'}
              </Button>
              <span className="text-sm text-muted-foreground">
                当前版本:
                {' '}
                {version}
              </span>
            </div>
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
