import type { CommandBlock } from './message-blocks'
import { CheckCircle2, ChevronDown, ChevronRight, Loader2, TerminalSquare, XCircle } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface CommandBlockCardProps {
  block: CommandBlock
}

export function CommandBlockCard({ block }: CommandBlockCardProps) {
  const [expanded, setExpanded] = useState(false)
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
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span className="rounded-full border border-border/50 bg-background/60 px-2 py-0.5">
          状态：{block.status === 'running' ? '运行中' : block.status === 'error' ? '失败' : '成功'}
        </span>
        {typeof block.exitCode === 'number' && (
          <span className="rounded-full border border-border/50 bg-background/60 px-2 py-0.5">
            Exit Code: {block.exitCode}
          </span>
        )}
      </div>
      {block.summary && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{block.summary}</p>
      )}
      {block.output && (
        <div className="mt-2">
          <button
            type="button"
            className="mb-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setExpanded(prev => !prev)}
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {expanded ? '收起完整输出' : '展开完整输出'}
          </button>
          <pre className="max-h-48 overflow-x-auto whitespace-pre-wrap break-all rounded-md border border-border/40 bg-background/60 px-2.5 py-2 text-[11px] text-muted-foreground">
            {expanded ? (block.rawOutput ?? block.output) : block.output}
          </pre>
        </div>
      )}
    </div>
  )
}
