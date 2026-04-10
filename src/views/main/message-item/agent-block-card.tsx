import type { AgentBlock } from './message-blocks'
import { Bot, CheckCircle2, Lightbulb, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AgentBlockCardProps {
  block: AgentBlock
}

export function AgentBlockCard({ block }: AgentBlockCardProps) {
  const Icon = block.status === 'error'
    ? XCircle
    : block.status === 'suggest'
      ? Lightbulb
      : CheckCircle2

  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2 text-xs',
        block.status === 'done' && 'border-sky-500/20 bg-sky-500/6',
        block.status === 'suggest' && 'border-amber-500/25 bg-amber-500/6',
        block.status === 'error' && 'border-destructive/25 bg-destructive/6',
      )}
    >
      <div className="flex items-center gap-2 font-medium">
        <span className="rounded-full border border-border/50 bg-background/80 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          Agent
        </span>
        <Bot className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span>{block.title}</span>
      </div>

      {block.hook && (
        <div className="mt-1 text-[11px] text-muted-foreground font-mono">
          {block.hook}
        </div>
      )}

      {block.description && (
        <p className="mt-2 leading-relaxed text-muted-foreground">
          {block.description}
        </p>
      )}
    </div>
  )
}
