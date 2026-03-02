/**
 * AI 消息底部栏
 * 显示时间、token 估算、复制/导出按钮
 */
import { Check, Copy, Download } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatWithLocalTZ } from '@/lib/time'
import { cn } from '@/lib/utils'

interface MessageFooterProps {
  content: string
  createdAt: number
  className?: string
}

export function MessageFooter({ content, createdAt, className }: MessageFooterProps) {
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
    <div className={cn('flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-border/30', className)}>
      {/* 左侧：时间 + token 数 */}
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

      {/* 右侧：操作按钮 */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-50 hover:opacity-100! transition-opacity"
          onClick={handleCopy}
          title={copied ? '已复制' : '复制消息'}
        >
          {copied
            ? <Check className="w-3 h-3 text-green-500" />
            : <Copy className="w-3 h-3" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-50 hover:opacity-100! transition-opacity"
          title="导出消息"
          onClick={() => {
            // TODO: 实现导出功能
          }}
        >
          <Download className="w-3 h-3" />
        </Button>
      </div>
    </div>
  )
}
