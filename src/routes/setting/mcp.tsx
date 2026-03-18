import type { CursorMcpConfig } from '@/types/mcp'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/i18n/provider'
import { getMcpConfig, updateMcpConfig } from '@/lib/mcp'

export const Route = createFileRoute('/setting/mcp')({
  component: RouteComponent,
  loader: async () => {
    const config = await getMcpConfig()
    return { config }
  },
})

function RouteComponent() {
  const { t } = useI18n()
  const { config } = Route.useLoaderData()
  const initialJson = useMemo(() => JSON.stringify(config, null, 2), [config])
  const [jsonText, setJsonText] = useState(initialJson)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    try {
      setSaving(true)
      const parsed = JSON.parse(jsonText) as CursorMcpConfig
      if (!parsed || typeof parsed !== 'object' || !parsed.mcpServers || typeof parsed.mcpServers !== 'object') {
        throw new Error('`mcpServers` is required and must be an object')
      }
      await updateMcpConfig(parsed)
      toast.success(t('settings.mcp.toast.saveSuccess'))
    }
    catch (error) {
      toast.error(t('settings.mcp.toast.saveError', { message: (error as Error).message }))
    }
    finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('settings.mcp.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('settings.mcp.description')}</p>
      </div>

      <div className="max-w-4xl space-y-4">
        <div className="rounded-lg border p-4 space-y-3">
          <Label className="text-base">{t('settings.mcp.configLabel')}</Label>
          <p className="text-xs text-muted-foreground">
            {t('settings.mcp.hint')}
          </p>
          <textarea
            value={jsonText}
            onChange={e => setJsonText(e.target.value)}
            className="h-[420px] w-full rounded-md border bg-transparent p-3 text-xs font-mono outline-none"
            spellCheck={false}
          />
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t('settings.mcp.saving') : t('common.save')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
