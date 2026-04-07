import { ChevronDown, ChevronRight, FolderTree, Info, Package, Wrench } from 'lucide-react'
import { useState } from 'react'
import { MarkdownRenderer } from '@/components/markdown/markdown-renderer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { useI18n } from '@/i18n/provider'
import type { Skill, SkillConfigField } from '../types'
import { SkillConfigForm } from './skill-config-form'

function ToolRow({ tool }: { tool: { name: string, description: string } }) {
  return (
    <div className="flex gap-3 py-2">
      <span className="mt-0.5 shrink-0">
        <Wrench className="size-3.5 text-muted-foreground" />
      </span>
      <div className="min-w-0">
        <code className="font-mono text-xs font-semibold text-foreground">{tool.name}</code>
        {tool.description && (
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{tool.description}</p>
        )}
      </div>
    </div>
  )
}

interface SkillCardProps {
  skill: Skill
  disabled: boolean
  onToggleDisabled: (skillName: string, disabled: boolean) => void
}

export function SkillCard({
  skill,
  disabled,
  onToggleDisabled,
}: SkillCardProps) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const hasDetails = skill.tools.length > 0
    || Boolean(skill.prompt)
    || (skill.config?.length ?? 0) > 0
    || skill.availableResourceDirs.length > 0
    || skill.allDirEntries.length > 0

  function getSourceLabel(sourceLabel: string) {
    if (sourceLabel === 'builtin')
      return t('settings.skills.sourceLabels.builtin')
    if (sourceLabel === 'external')
      return t('settings.skills.sourceLabels.external')
    return sourceLabel
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div
        className={`flex items-start gap-3 p-4 ${hasDetails ? 'cursor-pointer select-none transition-colors hover:bg-muted/50' : ''}`}
        onClick={() => hasDetails && setExpanded(value => !value)}
      >
        <div className="mt-0.5 shrink-0 rounded-md border bg-background p-1.5">
          <Package className="size-4 text-muted-foreground" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{skill.name}</span>
            <span className="text-xs text-muted-foreground">
              v
              {skill.version}
            </span>
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{getSourceLabel(skill.sourceLabel)}</Badge>
            {skill.toolCount > 0 && (
              <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                {t('settings.skills.card.toolCount', { count: skill.toolCount })}
              </Badge>
            )}
            <Badge variant={disabled ? 'destructive' : 'secondary'} className="px-1.5 py-0 text-[10px]">
              {disabled ? '已禁用' : '已启用'}
            </Badge>
          </div>
          <p className="mt-1 text-sm leading-snug text-muted-foreground">{skill.description}</p>
          <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
            {t('settings.skills.card.sourcePath')}
            {skill.relativeSourcePath || skill.sourcePath}
          </p>
        </div>

        {hasDetails && (
          <span className="mt-1 shrink-0 text-muted-foreground">
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </span>
        )}

        <div className="shrink-0" onClick={event => event.stopPropagation()}>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">禁用</span>
            <Switch
              checked={disabled}
              onCheckedChange={checked => onToggleDisabled(skill.name, checked)}
            />
          </div>
        </div>
      </div>

      {expanded && hasDetails && (
        <div className="space-y-4 border-t bg-muted/10 px-4 py-3">
          {skill.tools.length > 0 && (
            <div>
              <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Wrench className="size-3" />
                {t('settings.skills.card.toolsCapability')}
              </h4>
              <div className="divide-y">
                {skill.tools.map(tool => <ToolRow key={tool.name} tool={tool} />)}
              </div>
            </div>
          )}

          {skill.prompt && (
            <div>
              <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Info className="size-3" />
                {t('settings.skills.card.systemPrompt')}
              </h4>
              <div className="rounded-md border bg-muted/40 px-3 py-2">
                <MarkdownRenderer
                  content={skill.promptPreview ?? skill.prompt}
                  compact
                  className="text-xs"
                />
              </div>
            </div>
          )}

          <div>
            <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <FolderTree className="size-3" />
              {t('settings.skills.card.sourceAndDirs')}
            </h4>
            <div className="space-y-2 text-xs">
              <p className="text-muted-foreground">
                {t('settings.skills.card.source')}
                <span className="font-medium text-foreground">{getSourceLabel(skill.sourceLabel)}</span>
              </p>
              <p className="break-all font-mono text-muted-foreground">{skill.sourcePath}</p>
              {skill.availableResourceDirs.length > 0 && (
                <div>
                  <p className="mb-1 text-muted-foreground">{t('settings.skills.card.resourceDirs')}</p>
                  <div className="flex flex-wrap gap-1">
                    {skill.availableResourceDirs.map(dir => (
                      <Badge key={dir} variant="outline" className="px-1.5 py-0 text-[10px]">{dir}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {skill.allDirEntries.length > 0 && (
                <div>
                  <p className="mb-1 text-muted-foreground">{t('settings.skills.card.otherDirs')}</p>
                  <div className="flex flex-wrap gap-1">
                    {skill.allDirEntries.map(dir => (
                      <Badge key={dir} variant="outline" className="px-1.5 py-0 text-[10px]">{dir}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {skill.prompt && (
            <div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs">{t('settings.skills.card.viewFullPrompt')}</Button>
                </DialogTrigger>
                <DialogContent className="max-h-[80vh] max-w-3xl overflow-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {skill.name}
                      {' '}
                      {t('settings.skills.card.promptTitle')}
                    </DialogTitle>
                    <DialogDescription>{t('settings.skills.card.promptDescription')}</DialogDescription>
                  </DialogHeader>
                  <div className="rounded-md border bg-muted/40 px-4 py-3">
                    <MarkdownRenderer content={skill.prompt} className="text-sm" />
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {(skill.config?.length ?? 0) > 0 && (
            <SkillConfigForm
              skillName={skill.name}
              fields={skill.config as SkillConfigField[]}
              values={skill.configValues ?? {}}
            />
          )}
        </div>
      )}
    </div>
  )
}
