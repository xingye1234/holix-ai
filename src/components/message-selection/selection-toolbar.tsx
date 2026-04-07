import type { MessageExportFormat } from '@/lib/message-utils'
import { Copy, Download, Expand, Trash2, X } from 'lucide-react'
import { useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  filterExportableMessages,
  openMessagePreviewWindow,
  saveMessagesToFile,
  toExportableMessage,
} from '@/lib/message-utils'
import { useI18n } from '@/i18n/provider'
import { useMessageStore } from '@/store/message'
import useMessageSelection from '@/store/message-selection'

interface SelectionToolbarProps {
  /** 批量删除处理函数 */
  onDeleteSelected?: (messageIds: string[]) => void | Promise<number | void>
  /** 保留兼容：旧版导出回调 */
  onExportSelected?: (messageIds: string[]) => void
}

export function SelectionToolbar({
  onDeleteSelected,
  onExportSelected,
}: SelectionToolbarProps) {
  const { t } = useI18n()
  const selectedCount = useMessageSelection(state => state.getSelectedCount())
  const selectedMessageIds = useMessageSelection(state => state.selectedMessageIds)
  const disableSelectionMode = useMessageSelection(state => state.disableSelectionMode)

  const messages = useMessageStore(state => state.messages)

  const selectedMessages = Array.from(selectedMessageIds)
    .map(id => messages[id])
    .filter(Boolean)
    .map(toExportableMessage)

  const exportableMessages = filterExportableMessages(selectedMessages)

  const handleClose = () => {
    disableSelectionMode()
  }

  const handleDelete = useCallback(async () => {
    if (selectedCount === 0)
      return

    const ids = Array.from(selectedMessageIds)
    const deletedCount = await onDeleteSelected?.(ids)

    if (deletedCount === 0) {
      toast.error(t('selection.deleteNone'))
      return
    }

    toast.success(t('selection.deleted', { count: deletedCount ?? selectedCount }))
    disableSelectionMode()
  }, [disableSelectionMode, onDeleteSelected, selectedCount, selectedMessageIds, t])

  const handleCopy = useCallback(async () => {
    if (selectedCount === 0 || exportableMessages.length === 0) {
      toast.error(t('message.noExportableContent'))
      return
    }

    const text = exportableMessages.map(msg => msg.content).join('\n\n---\n\n')
    await navigator.clipboard.writeText(text)
    toast.success(t('selection.copied', { count: exportableMessages.length }))
  }, [exportableMessages, selectedCount, t])

  const handleExport = useCallback(async (format: MessageExportFormat) => {
    if (selectedCount === 0 || exportableMessages.length === 0) {
      toast.error(t('message.noExportableContent'))
      return
    }

    onExportSelected?.(Array.from(selectedMessageIds))

    const result = await saveMessagesToFile({
      messages: exportableMessages,
      format,
      suggestedName: `messages-${Date.now()}.${format}`,
    })

    if (result.canceled) {
      toast.info(t('preview.exportCanceled'))
      return
    }

    toast.success(t('preview.exportSuccess', { filePath: result.filePath }))
  }, [exportableMessages, onExportSelected, selectedCount, selectedMessageIds, t])

  const handlePreview = useCallback(() => {
    if (selectedCount === 0 || exportableMessages.length === 0) {
      toast.error(t('message.noExportableContent'))
      return
    }

    const win = openMessagePreviewWindow(exportableMessages)
    if (!win)
      toast.error(t('message.previewFailed'))
  }, [exportableMessages, selectedCount, t])

  if (selectedCount === 0)
    return null

  return (
    <div className="sticky top-0 z-50 w-full bg-background border-b shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 max-w-4xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {t('selection.selectedCount', { count: selectedCount })}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="gap-1.5 h-8"
          >
            <Copy className="w-4 h-4" />
            <span className="hidden sm:inline">{t('selection.copy')}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handlePreview}
            className="gap-1.5 h-8"
          >
            <Expand className="w-4 h-4" />
            <span className="hidden sm:inline">{t('selection.preview')}</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 h-8"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">{t('selection.export')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('txt')}>
                {t('preview.exportAsText')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('md')}>
                {t('preview.exportAsMarkdown')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('json')}>
                {t('preview.exportAsJson')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="gap-1.5 h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">{t('selection.delete')}</span>
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="gap-1.5 h-8"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">{t('common.cancel')}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
