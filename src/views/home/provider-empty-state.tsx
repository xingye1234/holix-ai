import { ArrowRight, CheckCircle2, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ProviderEmptyStateProps {
  onOpenProviders: () => void
  onOpenSkills: () => void
}

const checklist = [
  '新增一个 Provider',
  '确保它处于启用状态',
  '至少保留一个可用模型',
  '远端 API 补全 API Key，或使用 Ollama',
] as const

export function HomeProviderEmptyState({
  onOpenProviders,
  onOpenSkills,
}: ProviderEmptyStateProps) {
  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_360px]">
      <div className="rounded-[30px] border border-border/60 bg-card/78 p-6 shadow-[0_18px_48px_-34px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:p-7">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Settings2 className="h-5 w-5" />
        </div>
        <h2 className="mt-5 text-2xl font-semibold text-foreground">先完成模型接入</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
          目前首页还没有检测到可用 Provider。你可以先添加并启用一个支持模型列表的供应商，
          如果是远端 API，需要补全 API Key；如果是 Ollama，本地可直接开始。
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button className="h-11 rounded-2xl px-5" onClick={onOpenProviders}>
            打开 Provider 设置
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="h-11 rounded-2xl px-5" onClick={onOpenSkills}>
            先看看技能市场
          </Button>
        </div>
      </div>

      <div className="rounded-[30px] border border-border/60 bg-card/74 p-6 shadow-[0_18px_48px_-34px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        <div className="text-sm font-medium text-foreground">激活检查清单</div>
        <div className="mt-4 space-y-3">
          {checklist.map(item => (
            <div key={item} className="flex items-start gap-3 rounded-2xl border border-border/50 bg-background/70 px-4 py-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
              <span className="text-sm leading-6 text-muted-foreground">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
