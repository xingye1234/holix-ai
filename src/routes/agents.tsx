import { createFileRoute } from '@tanstack/react-router'
import { Bot, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/provider'

export const Route = createFileRoute('/agents')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useI18n()

  return (
    <div className="w-full h-[calc(100vh-var(--app-header-height))] overflow-auto">
      <div className="w-full max-w-5xl mx-auto p-6 space-y-6">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 text-primary">
            <Bot className="h-5 w-5" />
            <h1 className="text-xl font-semibold">{t('agents.title')}</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{t('agents.description')}</p>
          <Button className="mt-4 gap-2" variant="outline" disabled>
            <Plus className="h-4 w-4" />
            {t('agents.createSoon')}
          </Button>
        </div>
      </div>
    </div>
  )
}
