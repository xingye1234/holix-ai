import type { CommandBlock } from './message-blocks'
import { CheckCircle2, Loader2, TerminalSquare, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CommandBlockCardProps {
  block: CommandBlock
}

export function CommandBlockCard({ block }: CommandBlockCardProps) {
  const StatusIcon = block.status === 'running'
    ? Loader2
    : block.status === 'error'
      ? XCircle
      : CheckCircle2

  return (
    <div
      className={cn(
        'rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 text-xs',
        block.status === 'error' && 'border-destructive/25 bg-destructive/8',
      )}
    >
      <div className="flex items-center gap-2">
        <TerminalSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="font-medium">{block.toolName}</span>
        <span className="ml-auto">
          <StatusIcon className={cn('h-3.5 w-3.5 shrink-0', block.status === 'running' && 'animate-spin')} />
        </span>
      </div>
      <pre className="mt-2 rounded-md border border-border/40 bg-background/70 px-2.5 py-2 text-[11px] text-foreground whitespace-pre-wrap break-all overflow-x-auto">
        {block.command}
      </pre>
      {block.output && (
        <pre className="mt-2 max-h-48 overflow-x-auto whitespace-pre-wrap break-all rounded-md border border-border/40 bg-background/60 px-2.5 py-2 text-[11px] text-muted-foreground">
          {block.output}
        </pre>
      )}
    </div>
  )
}
