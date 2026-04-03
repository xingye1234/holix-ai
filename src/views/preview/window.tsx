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
import { useI18n } from '@/i18n/provider'
import {
  getMessagePreviewSession,
  saveMessagesToFile,
} from '@/lib/message-utils'
import { formatWithLocalTZ } from '@/lib/time'

export function PreviewWindow() {
  const { t } = useI18n()
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
        toast.info(t('preview.exportCanceled'))
        return
      }

      toast.success(t('preview.exportSuccess', { filePath: res.filePath }))
    }
    catch (error) {
      console.error(error)
      toast.error(t('preview.exportFailed'))
    }
  }

  if (!messages.length) {
    return (
      <div className="h-screen flex items-center justify-center flex-col gap-3 text-muted-foreground">
        <p>{t('preview.noMessages')}</p>
        <Button variant="outline" onClick={() => window.close()}>{t('preview.closeWindow')}</Button>
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
            placeholder={t('preview.fileNamePlaceholder')}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Download className="w-4 h-4" />
                {t('preview.export')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('txt')}>{t('preview.exportAsText')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('md')}>{t('preview.exportAsMarkdown')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('json')}>{t('preview.exportAsJson')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />
            {t('preview.print')}
          </Button>

          <Button size="sm" variant="ghost" className="gap-1.5 ml-auto" onClick={() => location.reload()}>
            <RefreshCcw className="w-4 h-4" />
            {t('preview.refresh')}
          </Button>
        </div>
      </div>

      <div className="preview-page mx-auto max-w-5xl px-4 py-6 space-y-4">
        {messages.map(message => (
          <article key={message.id} className="rounded-xl border bg-card p-4 shadow-xs">
            <header className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{message.role === 'assistant' ? t('preview.role.assistant') : message.role === 'user' ? t('preview.role.user') : t(`preview.role.${message.role}`)}</span>
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
