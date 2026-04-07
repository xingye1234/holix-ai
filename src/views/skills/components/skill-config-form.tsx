import { Settings2 } from 'lucide-react'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/i18n/provider'
import { trpcClient } from '@/lib/trpc-client'
import type { SkillConfigField } from '../types'

interface SkillConfigFormProps {
  skillName: string
  fields: SkillConfigField[]
  values: Record<string, unknown>
}

export function SkillConfigForm({
  skillName,
  fields,
  values,
}: SkillConfigFormProps) {
  const { t } = useI18n()
  const [localValues, setLocalValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const field of fields) {
      const stored = values[field.key]
      init[field.key] = stored !== undefined ? String(stored) : (field.default !== undefined ? String(field.default) : '')
    }
    return init
  })

  if (fields.length === 0)
    return null

  async function handleChange(key: string, value: string) {
    setLocalValues(prev => ({ ...prev, [key]: value }))
    await trpcClient.skill.setConfig({ skillName, key, value })
  }

  return (
    <div>
      <h4 className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        <Settings2 className="size-3" />
        {t('settings.skills.card.config')}
      </h4>
      <div className="space-y-3">
        {fields.map(field => (
          <div key={field.key} className="space-y-1">
            <Label className="text-xs font-medium">
              {field.label}
              {field.required && <span className="ml-0.5 text-destructive">*</span>}
            </Label>
            {field.description && (
              <p className="text-[11px] leading-snug text-muted-foreground">{field.description}</p>
            )}
            {field.type === 'boolean'
              ? (
                  <input
                    type="checkbox"
                    checked={localValues[field.key] === 'true'}
                    onChange={event => handleChange(field.key, String(event.target.checked))}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                )
              : field.type === 'select' && field.options
                ? (
                    <select
                      value={localValues[field.key]}
                      onChange={event => handleChange(field.key, event.target.value)}
                      className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      {!field.required && <option value="">{t('settings.skills.card.unset')}</option>}
                      {field.options.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  )
                : (
                    <Input
                      type={field.type === 'password' || field.secret ? 'password' : field.type === 'number' ? 'number' : 'text'}
                      value={localValues[field.key]}
                      placeholder={field.default !== undefined ? String(field.default) : ''}
                      onChange={event => handleChange(field.key, event.target.value)}
                      className="h-8 text-xs"
                    />
                  )}
          </div>
        ))}
      </div>
    </div>
  )
}
