import { Copy, Download, Trash2, X } from 'lucide-react'
import { useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import useMessageSelection from '@/store/message-selection'

interface SelectionToolbarProps {
  /** 批量删除处理函数 */
  onDeleteSelected?: (messageIds: string[]) => void
  /** 批量导出处理函数 */
  onExportSelected?: (messageIds: string[]) => void
}

export function SelectionToolbar({
  onDeleteSelected,
  onExportSelected,
}: SelectionToolbarProps) {
  const selectedCount = useMessageSelection(state => state.getSelectedCount())
  const selectedMessageIds = useMessageSelection(state => state.selectedMessageIds)
  const clearSelection = useMessageSelection(state => state.clearSelection)
  const disableSelectionMode = useMessageSelection(state => state.disableSelectionMode)

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

    // 这里需要获取消息内容并复制
    // 由于我们只有 ID，需要从父组件传入消息内容
    toast.info('复制功能开发中...')
  }, [selectedCount])

  const handleExport = useCallback(() => {
    if (selectedCount === 0)
      return

    const ids = Array.from(selectedMessageIds)
    onExportSelected?.(ids)

    toast.info('导出功能开发中...')
  }, [selectedCount, selectedMessageIds, onExportSelected])

  if (selectedCount === 0)
    return null

  return (
    <div className="sticky top-0 z-50 w-full bg-background border-b shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 max-w-4xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            已选择 <span className="text-primary">{selectedCount}</span> 条消息
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* 复制按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="gap-1.5 h-8"
          >
            <Copy className="w-4 h-4" />
            <span className="hidden sm:inline">复制</span>
          </Button>

          {/* 导出菜单 */}
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
              <DropdownMenuItem onClick={handleExport}>
                导出为文本
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExport}>
                导出为 Markdown
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExport}>
                导出为 JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 删除按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="gap-1.5 h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">删除</span>
          </Button>

          {/* 分隔线 */}
          <div className="w-px h-6 bg-border mx-1" />

          {/* 关闭按钮 */}
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
