import type { MessageExportFormat } from '@/lib/message-utils'
import { Download, Printer, RefreshCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { MarkdownRenderer } from '@/components/markdown/markdown-renderer'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  getMessagePreviewSession,
  saveMessagesToFile,
} from '@/lib/message-utils'
import { formatWithLocalTZ } from '@/lib/time'

export function PreviewWindow() {
  const [fileName, setFileName] = useState('messages-export')

  const session = useMemo(() => {
    const query = new URLSearchParams(window.location.search)
    return query.get('session') || ''
  }, [])

  const messages = useMemo(() => {
    if (!session)
      return []
    return getMessagePreviewSession(session) || []
  }, [session])

  const handleExport = async (format: MessageExportFormat) => {
    if (!messages.length)
      return

    try {
      const res = await saveMessagesToFile({
        messages,
        format,
        suggestedName: `${fileName}.${format}`,
      })

      if (res.canceled) {
        toast.info('已取消导出')
        return
      }

      toast.success(`导出成功：${res.filePath}`)
    }
    catch (error) {
      console.error(error)
      toast.error('导出失败')
    }
  }

  if (!messages.length) {
    return (
      <div className="h-screen flex items-center justify-center flex-col gap-3 text-muted-foreground">
        <p>未找到可预览的消息内容。</p>
        <Button variant="outline" onClick={() => window.close()}>关闭窗口</Button>
      </div>
    )
  }

  return (
    <div className="h-screen bg-background text-foreground overflow-auto">
      <style>{`@media print { .preview-toolbar { display: none !important; } .preview-page { padding: 0 !important; } }`}</style>

      <div className="preview-toolbar sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-2.5 flex items-center gap-2">
          <Input
            value={fileName}
            onChange={e => setFileName(e.target.value.trim() || 'messages-export')}
            className="max-w-xs h-8"
            placeholder="导出文件名"
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Download className="w-4 h-4" />
                导出
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('txt')}>导出为文本</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('md')}>导出为 Markdown</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('json')}>导出为 JSON</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />
            打印
          </Button>

          <Button size="sm" variant="ghost" className="gap-1.5 ml-auto" onClick={() => location.reload()}>
            <RefreshCcw className="w-4 h-4" />
            刷新
          </Button>
        </div>
      </div>

      <div className="preview-page mx-auto max-w-5xl px-4 py-6 space-y-4">
        {messages.map(message => (
          <article key={message.id} className="rounded-xl border bg-card p-4 shadow-xs">
            <header className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{message.role === 'assistant' ? 'AI' : message.role === 'user' ? '用户' : message.role}</span>
              <span>{formatWithLocalTZ(message.createdAt, 'YYYY-MM-DD HH:mm:ss')}</span>
            </header>

            {message.role === 'user'
              ? <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
              : <MarkdownRenderer content={message.content} compact={false} />}
          </article>
        ))}
      </div>
    </div>
  )
}
