import type { MessageTelemetry } from '@/node/database/schema/chat'
import { formatWithLocalTZ } from '@/lib/time'
import { Separator } from '@/components/ui/separator'

interface TelemetryPanelProps {
  telemetry: MessageTelemetry
}

function formatDuration(start?: number, end?: number) {
  if (!start || !end || end < start)
    return null

  const duration = end - start
  if (duration < 1000)
    return `${duration} ms`

  return `${(duration / 1000).toFixed(2)} s`
}

function StatItem({ label, value }: { label: string, value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '')
    return null

  return (
    <div className="rounded-xl border border-border/40 bg-background/70 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/75">{label}</div>
      <div className="mt-1 text-xs font-medium text-foreground">{value}</div>
    </div>
  )
}

export function TelemetryPanel({ telemetry }: TelemetryPanelProps) {
  const totalDuration = formatDuration(
    telemetry.execution?.startedAt,
    telemetry.execution?.completedAt,
  )

  const firstTokenDuration = formatDuration(
    telemetry.execution?.startedAt,
    telemetry.execution?.firstTokenAt,
  )

  return (
    <div className="mt-2 rounded-2xl border border-border/50 bg-background/55 p-3 text-xs">
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="text-[11px] font-medium text-foreground">输入统计</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <StatItem label="Provider" value={telemetry.provider} />
            <StatItem label="Model" value={telemetry.model} />
            <StatItem label="Chars" value={telemetry.input?.charCount} />
            <StatItem label="Tokens" value={telemetry.input?.estimatedTokens} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] font-medium text-foreground">输出统计</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <StatItem label="Chars" value={telemetry.output?.charCount} />
            <StatItem label="Tokens" value={telemetry.output?.estimatedTokens} />
            <StatItem label="Total Tokens" value={telemetry.usage?.totalEstimatedTokens} />
          </div>
        </div>
      </div>

      <Separator className="my-3 bg-border/50" />

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="text-[11px] font-medium text-foreground">执行轨迹</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <StatItem label="LLM Runs" value={telemetry.execution?.llmRuns} />
            <StatItem label="Chain Runs" value={telemetry.execution?.chainRuns} />
            <StatItem label="Tool Calls" value={telemetry.execution?.toolCalls} />
            <StatItem label="Tool Names" value={telemetry.execution?.toolNames?.join(', ')} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] font-medium text-foreground">时间</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <StatItem label="Started" value={telemetry.execution?.startedAt ? formatWithLocalTZ(telemetry.execution.startedAt, 'HH:mm:ss') : null} />
            <StatItem label="First Token" value={firstTokenDuration} />
            <StatItem label="Completed" value={telemetry.execution?.completedAt ? formatWithLocalTZ(telemetry.execution.completedAt, 'HH:mm:ss') : null} />
            <StatItem label="Duration" value={totalDuration} />
          </div>
        </div>
      </div>
    </div>
  )
}
