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
  openMessagePreviewWindow,
  saveMessagesToFile,
  toExportableMessage,
} from '@/lib/message-utils'
import { useMessageStore } from '@/store/message'
import useMessageSelection from '@/store/message-selection'

interface SelectionToolbarProps {
  /** 批量删除处理函数 */
  onDeleteSelected?: (messageIds: string[]) => void
  /** 保留兼容：旧版导出回调 */
  onExportSelected?: (messageIds: string[]) => void
}

export function SelectionToolbar({
  onDeleteSelected,
  onExportSelected,
}: SelectionToolbarProps) {
  const selectedCount = useMessageSelection(state => state.getSelectedCount())
  const selectedMessageIds = useMessageSelection(state => state.selectedMessageIds)
  const disableSelectionMode = useMessageSelection(state => state.disableSelectionMode)

  const messages = useMessageStore(state => state.messages)

  const selectedMessages = Array.from(selectedMessageIds)
    .map(id => messages[id])
    .filter(Boolean)
    .map(toExportableMessage)

  const handleClose = () => {
    disableSelectionMode()
  }

  const handleDelete = useCallback(() => {
    if (selectedCount === 0)
      return

    const ids = Array.from(selectedMessageIds)
    onDeleteSelected?.(ids)

    toast.success(`已删除 ${selectedCount} 条消息`)
    disableSelectionMode()
  }, [selectedCount, selectedMessageIds, onDeleteSelected, disableSelectionMode])

  const handleCopy = useCallback(async () => {
    if (selectedCount === 0)
      return

    const text = selectedMessages.map(msg => msg.content).join('\n\n---\n\n')
    await navigator.clipboard.writeText(text)
    toast.success(`已复制 ${selectedCount} 条消息`)
  }, [selectedCount, selectedMessages])

  const handleExport = useCallback(async (format: MessageExportFormat) => {
    if (selectedCount === 0)
      return

    onExportSelected?.(Array.from(selectedMessageIds))

    const result = await saveMessagesToFile({
      messages: selectedMessages,
      format,
      suggestedName: `messages-${Date.now()}.${format}`,
    })

    if (result.canceled) {
      toast.info('已取消导出')
      return
    }

    toast.success(`导出成功：${result.filePath}`)
  }, [onExportSelected, selectedCount, selectedMessageIds, selectedMessages])

  const handlePreview = useCallback(() => {
    if (selectedCount === 0)
      return

    const win = openMessagePreviewWindow(selectedMessages)
    if (!win)
      toast.error('新窗口打开失败，请检查系统设置')
  }, [selectedCount, selectedMessages])

  if (selectedCount === 0)
    return null

  return (
    <div className="sticky top-0 z-50 w-full bg-background border-b shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 max-w-4xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            已选择
            {' '}
            <span className="text-primary">{selectedCount}</span>
            {' '}
            条消息
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
            <span className="hidden sm:inline">复制</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handlePreview}
            className="gap-1.5 h-8"
          >
            <Expand className="w-4 h-4" />
            <span className="hidden sm:inline">放大查看</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 h-8"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">导出</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('txt')}>
                导出为文本
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('md')}>
                导出为 Markdown
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('json')}>
                导出为 JSON
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
            <span className="hidden sm:inline">删除</span>
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="gap-1.5 h-8"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">取消</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
