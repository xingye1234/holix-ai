import { Copy, Download, Expand } from 'lucide-react'
import { ContextMenuContent, ContextMenuItem } from '@/components/ui/context-menu'

interface MessageContextMenuProps {
  content: string
  generating: boolean
  onPreview: () => void
  onExport: () => void
  onDelete: () => void
}

export function MessageContextMenu({ content, generating, onPreview, onExport, onDelete }: MessageContextMenuProps) {
  if (generating)
    return null

  return (
    <ContextMenuContent>
      <ContextMenuItem onClick={() => content && navigator.clipboard.writeText(content)}>
        <Copy className="w-3.5 h-3.5 mr-2" />
        复制消息
      </ContextMenuItem>
      <ContextMenuItem onClick={onPreview}>
        <Expand className="w-3.5 h-3.5 mr-2" />
        放大查看
      </ContextMenuItem>
      <ContextMenuItem onClick={onExport}>
        <Download className="w-3.5 h-3.5 mr-2" />
        导出消息
      </ContextMenuItem>
      <ContextMenuItem variant="destructive" onClick={onDelete}>
        删除消息
      </ContextMenuItem>
    </ContextMenuContent>
  )
}
