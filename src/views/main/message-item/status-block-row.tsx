import type { StatusBlock } from './message-blocks'
import { AlertCircle, CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatusBlockRowProps {
  block: StatusBlock
}

export function StatusBlockRow({ block }: StatusBlockRowProps) {
  const Icon = block.status === 'running'
    ? Loader2
    : block.status === 'done'
      ? CheckCircle2
      : block.status === 'error'
        ? AlertCircle
        : Sparkles

  return (
    <div className="flex items-start gap-2 rounded-lg border border-border/40 bg-muted/15 px-3 py-2 text-xs text-muted-foreground">
      <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', block.status === 'running' && 'animate-spin')} />
      <div className="min-w-0">
        <p className="font-medium text-foreground">{block.title}</p>
        {block.description && (
          <p className="mt-0.5 leading-relaxed">{block.description}</p>
        )}
      </div>
    </div>
  )
}
