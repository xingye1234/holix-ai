import type { TimelineBlock } from './message-blocks'
import { CheckCircle2, ChevronDown, ChevronRight, Clock3, Loader2, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatWithLocalTZ } from '@/lib/time'
import { cn } from '@/lib/utils'

interface TimelineBlockCardProps {
  block: TimelineBlock
}

function TimelineStatusIcon({ status }: { status: 'running' | 'done' | 'error' }) {
  if (status === 'running')
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
  if (status === 'error')
    return <XCircle className="h-3.5 w-3.5 text-destructive" />
  return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
}

export function TimelineBlockCard({ block }: TimelineBlockCardProps) {
  const [expanded, setExpanded] = useState(false)
  const statusSummary = useMemo(() => {
    const hasRunning = block.items.some(item => item.status === 'running')
    const hasError = block.items.some(item => item.status === 'error')
    if (hasRunning)
      return '进行中'
    if (hasError)
      return '有异常'
    return '已完成'
  }, [block.items])

  return (
    <div className="rounded-xl border border-border/40 bg-muted/10 px-3 py-2 text-xs">
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setExpanded(prev => !prev)}
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <div className="font-medium">执行时间线</div>
        <span className="rounded-full border border-border/50 bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground">
          {statusSummary}
        </span>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{block.items.length} steps</span>
          {typeof block.totalEstimatedTokens === 'number' && <span>{block.totalEstimatedTokens} tokens</span>}
          {typeof block.totalDurationMs === 'number' && <span>{block.totalDurationMs} ms</span>}
        </div>
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5 border-t border-border/30 pt-2">
        {block.items.map(item => (
          <div
            key={item.id}
            className={cn(
              'flex items-start gap-2 rounded-md border border-border/40 bg-background/60 px-2 py-1.5',
              item.status === 'error' && 'border-destructive/30 bg-destructive/5',
            )}
          >
            <TimelineStatusIcon status={item.status} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{item.title}</span>
                {item.at && (
                  <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                    <Clock3 className="h-2.5 w-2.5" />
                    {formatWithLocalTZ(item.at, 'HH:mm:ss')}
                  </span>
                )}
              </div>
              {item.description && <div className="mt-0.5 text-[11px] text-muted-foreground break-all">{item.description}</div>}
            </div>
          </div>
        ))}
        </div>
      )}
    </div>
  )
}
