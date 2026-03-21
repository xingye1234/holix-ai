/**
 * AI 消息底部栏
 * 显示时间、token 估算、复制/导出按钮
 */
import { Check, Copy, Download, Expand, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '@/i18n/provider'
import { Button } from '@/components/ui/button'
import { formatWithLocalTZ } from '@/lib/time'
import { cn } from '@/lib/utils'

interface MessageFooterProps {
  content: string
  createdAt: number
  className?: string
  /** 隐藏时间/token 元数据，仅显示操作按鈕（用于用户消息） */
  hideMetadata?: boolean
  onPreview?: () => void
  onExport?: () => void
  onDelete?: () => void
}

export function MessageFooter({ content, createdAt, className, hideMetadata, onPreview, onExport, onDelete }: MessageFooterProps) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const tokenCount = content ? Math.ceil(content.length / 4) : 0

  const handleCopy = () => {
    if (!content)
      return
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2',
        !hideMetadata && 'mt-2 pt-1.5 border-t border-border/30',
        className,
      )}
    >
      {/* 左侧：时间 + token 数 */}
      {!hideMetadata && (
        <div className="flex items-center gap-2 text-[10px] opacity-50">
          <span>{formatWithLocalTZ(createdAt, 'HH:mm')}</span>
          {tokenCount > 0 && (
            <>
              <span>·</span>
              <span>
                {tokenCount}
                {' '}
                tokens
              </span>
            </>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <div className={cn('flex items-center gap-0.5', hideMetadata && 'ml-auto')}>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-50 hover:opacity-100! transition-opacity"
          onClick={handleCopy}
          title={copied ? t('message.copied') : t('message.copy')}
        >
          {copied
            ? <Check className="w-3 h-3 text-green-500" />
            : <Copy className="w-3 h-3" />}
        </Button>
        {onPreview && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-50 hover:opacity-100! transition-opacity"
            onClick={onPreview}
            title={t('message.preview')}
          >
            <Expand className="w-3 h-3" />
          </Button>
        )}
        {onExport && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-50 hover:opacity-100! transition-opacity"
            onClick={onExport}
            title={t('message.export')}
          >
            <Download className="w-3 h-3" />
          </Button>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-30 hover:opacity-100! hover:text-destructive transition-all"
            onClick={onDelete}
            title={t('message.delete')}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  )
}
