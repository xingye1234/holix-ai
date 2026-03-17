/**
 * 生成中状态指示器
 * - 无内容时：显示跳动三点（"思考中"）
 * - 工具调用中：显示工具执行状态
 */
import { Brain, Wrench } from 'lucide-react'
import { useI18n } from '@/i18n/provider'
import { cn } from '@/lib/utils'

interface GeneratingIndicatorProps {
  /** 是否仍处于 pending（还没开始输出任何 token） */
  isPending: boolean
  /** 是否正在执行工具 */
  isToolRunning?: boolean
  /** 当前执行的工具名称列表 */
  runningTools?: string[]
  className?: string
}

export function GeneratingIndicator({
  isPending,
  isToolRunning = false,
  runningTools = [],
  className,
}: GeneratingIndicatorProps) {
  const { t } = useI18n()

  // 工具调用状态
  if (isToolRunning && runningTools.length > 0) {
    return (
      <div className={cn('flex items-center gap-2.5 py-1', className)}>
        <Wrench className="w-3.5 h-3.5 shrink-0 text-primary animate-pulse" />
        <div className="flex items-center gap-1">
          <span className="typing-dot bg-muted-foreground" />
          <span className="typing-dot bg-muted-foreground" />
          <span className="typing-dot bg-muted-foreground" />
        </div>
        <span className="text-xs text-muted-foreground select-none">
          正在使用工具: {runningTools.join(', ')}
        </span>
      </div>
    )
  }

  // 默认思考状态
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
        {isPending ? t('generating.thinking') : t('generating.generating')}
      </span>
    </div>
  )
}
