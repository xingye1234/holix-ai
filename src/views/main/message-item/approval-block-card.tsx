import type { ApprovalBlock } from './message-blocks'
import { CheckCircle2, Clock3, ShieldAlert, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useToolApprovalStore } from '@/store/tool-approval'

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
  const approve = useToolApprovalStore(state => state.approve)
  const deny = useToolApprovalStore(state => state.deny)
  const approveAlwaysForSkill = useToolApprovalStore(state => state.approveAlwaysForSkill)
  const approveAllForSession = useToolApprovalStore(state => state.approveAllForSession)
  const Icon = block.status === 'pending'
    ? Clock3
    : block.status === 'approved'
      ? CheckCircle2
      : XCircle

  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2 text-xs',
        block.status === 'pending' && 'border-amber-500/25 bg-amber-500/6',
        block.status === 'approved' && 'border-emerald-500/20 bg-emerald-500/6',
        block.status === 'denied' && 'border-destructive/25 bg-destructive/6',
      )}
    >
      <div className="flex items-center gap-2 font-medium">
        <span className="rounded-full border border-border/50 bg-background/80 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          Approval
        </span>
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span>{block.title}</span>
        {block.toolName && (
          <span className="text-muted-foreground font-mono text-[11px]">
            {block.toolName}
          </span>
        )}
        {block.skillName && (
          <span className="text-muted-foreground font-mono text-[11px]">
            ({block.skillName})
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
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldAlert className="h-3 w-3 shrink-0" />
            <span>请确认是否允许执行该高风险操作。</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={approveAlwaysForSkill}>
              始终允许此 Skill
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={approveAllForSession}>
              本次对话全部允许
            </Button>
          </div>

          <div className="flex items-center justify-end gap-1.5">
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={deny}>
              拒绝
            </Button>
            <Button size="sm" variant="destructive" className="h-7 text-[11px]" onClick={approve}>
              批准执行
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
