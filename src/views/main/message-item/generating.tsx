/**
 * 生成中状态指示器
 * - 无内容时：显示跳动三点（"思考中"）
 */
import { Brain } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GeneratingIndicatorProps {
  /** 是否仍处于 pending（还没开始输出任何 token） */
  isPending: boolean
  className?: string
}

export function GeneratingIndicator({ isPending, className }: GeneratingIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-2.5 py-1', className)}>
      <Brain
        className={cn(
          'w-3.5 h-3.5 shrink-0',
          isPending
            ? 'text-primary animate-pulse'
            : 'text-muted-foreground',
        )}
      />
      <div className="flex items-center gap-1">
        <span className="typing-dot bg-muted-foreground" />
        <span className="typing-dot bg-muted-foreground" />
        <span className="typing-dot bg-muted-foreground" />
      </div>
      <span className="text-xs text-muted-foreground select-none">
        {isPending ? '思考中' : '生成中'}
      </span>
    </div>
  )
}
