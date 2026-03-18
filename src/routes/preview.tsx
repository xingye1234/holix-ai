import type { MessageExportFormat } from '@/lib/message-utils'
import { createFileRoute } from '@tanstack/react-router'
import { Download, Eye, EyeOff, Printer, RefreshCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/preview')({
  validateSearch: search => ({
    session: typeof search.session === 'string' ? search.session : '',
  }),
  component: PreviewPage,
})

function PreviewPage() {
  const { t } = useTranslation()
  const { session } = Route.useSearch()
  const [fileName, setFileName] = useState('messages-export')
  const [focusMode, setFocusMode] = useState(false)

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
      <style>
        {`
        @media print {
          .preview-toolbar { display: none !important; }
          .preview-page {
            padding: 0 !important;
            max-width: 100% !important;
          }
          .preview-card {
            border: none !important;
            box-shadow: none !important;
            margin-bottom: 1.5rem !important;
            page-break-inside: avoid !important;
          }
          .preview-header {
            color: #666 !important;
            border-bottom: 1px solid #ddd !important;
            padding-bottom: 0.5rem !important;
            margin-bottom: 1rem !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
        }
        .preview-toolbar {
          transition: transform 0.3s ease, opacity 0.3s ease;
        }
        .preview-toolbar.hidden {
          transform: translateY(-100%);
          opacity: 0;
          pointer-events: none;
        }
      `}
      </style>

      <div className={cn(
        'preview-toolbar sticky top-0 z-50 border-b bg-background/95 backdrop-blur',
        focusMode && 'hidden',
      )}
      >
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

          <Button
            size="sm"
            variant={focusMode ? 'default' : 'outline'}
            className="gap-1.5"
            onClick={() => setFocusMode(!focusMode)}
          >
            {focusMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {focusMode ? t('preview.exitFocus') : t('preview.focusMode')}
          </Button>

          <Button size="sm" variant="ghost" className="gap-1.5 ml-auto" onClick={() => location.reload()}>
            <RefreshCcw className="w-4 h-4" />
            {t('preview.refresh')}
          </Button>
        </div>
      </div>

      {/* 专注模式下的浮动控制按钮 */}
      {focusMode && (
        <div className="fixed bottom-6 right-6 z-40">
          <Button
            size="lg"
            className="rounded-full shadow-lg"
            onClick={() => setFocusMode(false)}
          >
            <EyeOff className="w-5 h-5 mr-2" />
            {t('preview.showMenu')}
          </Button>
        </div>
      )}

      <div className="preview-page mx-auto max-w-5xl px-4 py-6 space-y-4">
        {messages.map(message => (
          <article key={message.id} className="preview-card rounded-xl border bg-card p-6 shadow-sm">
            <header className="preview-header mb-3 flex items-center justify-between text-xs text-muted-foreground pb-2 border-b">
              <span className="font-medium">
                {message.role === 'assistant'
                  ? t('preview.role.assistant')
                  : message.role === 'user'
                    ? t('preview.role.user')
                    : t(`preview.role.${message.role}`)}
              </span>
              <span>{formatWithLocalTZ(message.createdAt, 'YYYY-MM-DD HH:mm:ss')}</span>
            </header>

            <div className="prose prose-sm max-w-none dark:prose-invert">
              {message.role === 'user'
                ? <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                : <MarkdownRenderer content={message.content} compact={false} />}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
