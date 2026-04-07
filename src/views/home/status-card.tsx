import { Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { HomeMode, HomeModeCopy, HomeStatusBadge } from './types'

interface HomeStatusCardProps {
  defaultProviderName: string
  mode: HomeMode
  modeCopy: HomeModeCopy
  readyProviderCount: number
  statusBadges: HomeStatusBadge[]
}

export function HomeStatusCard({
  defaultProviderName,
  mode,
  modeCopy,
  readyProviderCount,
  statusBadges,
}: HomeStatusCardProps) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card/72 px-5 py-4 shadow-[0_18px_48px_-34px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="flex flex-col gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs text-muted-foreground shadow-[0_8px_24px_-18px_rgba(0,0,0,0.18)]">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {modeCopy.kicker}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {statusBadges.map(item => (
            <Badge key={item.label} variant={item.variant} className="rounded-full px-3 py-1">
              {item.label}
            </Badge>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[18px] border border-border/50 bg-background/78 px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">当前状态</div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {mode === 'starter' ? '工作台已就绪，可直接开始第一条任务' : '已进入持续协作状态，可继续发起新任务'}
            </div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">{modeCopy.subtitle}</div>
          </div>
          <div className="rounded-[18px] border border-border/50 bg-background/78 px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">默认 Provider</div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {defaultProviderName || '尚未设置'}
            </div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">
              {readyProviderCount > 0 ? `${readyProviderCount} 个 Provider 已激活` : '还没有可用的模型通道'}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
