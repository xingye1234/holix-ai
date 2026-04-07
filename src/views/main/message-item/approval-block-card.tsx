import type { ApprovalBlock } from './message-blocks'
import { CheckCircle2, Clock3, ShieldAlert, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ApprovalBlockCardProps {
  block: ApprovalBlock
}

function formatArgs(args?: Record<string, unknown>) {
  if (!args || Object.keys(args).length === 0)
    return null

  return JSON.stringify(args, null, 2)
}

export function ApprovalBlockCard({ block }: ApprovalBlockCardProps) {
  const argsDisplay = formatArgs(block.args)
  const Icon = block.status === 'pending'
    ? Clock3
    : block.status === 'approved'
      ? CheckCircle2
      : XCircle

  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2.5 text-xs',
        block.status === 'pending' && 'border-amber-500/30 bg-amber-500/8',
        block.status === 'approved' && 'border-emerald-500/25 bg-emerald-500/8',
        block.status === 'denied' && 'border-destructive/25 bg-destructive/8',
      )}
    >
      <div className="flex items-center gap-2 font-medium">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span>{block.title}</span>
        {block.toolName && (
          <span className="text-muted-foreground font-mono text-[11px]">
            {block.toolName}
          </span>
        )}
      </div>
      {block.command && (
        <pre className="mt-2 rounded-md border border-border/40 bg-background/70 px-2.5 py-2 text-[11px] text-foreground whitespace-pre-wrap break-all overflow-x-auto">
          {block.command}
        </pre>
      )}
      {block.reason && (
        <p className="mt-2 text-muted-foreground leading-relaxed">{block.reason}</p>
      )}
      {argsDisplay && !block.command && (
        <pre className="mt-2 rounded-md border border-border/40 bg-background/70 px-2.5 py-2 text-[11px] text-muted-foreground whitespace-pre-wrap break-all overflow-x-auto">
          {argsDisplay}
        </pre>
      )}
      {block.status === 'pending' && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldAlert className="h-3 w-3 shrink-0" />
          <span>后续会接入消息内批准与拒绝操作。</span>
        </div>
      )}
    </div>
  )
}
