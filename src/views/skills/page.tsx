import { ChevronDown, ChevronRight, Download, FolderTree, Info, Package, Settings2, Sparkles, Star, Wrench, Zap } from 'lucide-react'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { MarkdownRenderer } from '@/components/markdown/markdown-renderer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useI18n } from '@/i18n/provider'
import { updateConfig } from '@/lib/config'
import { trpcClient } from '@/lib/trpc-client'

// ─── 单个工具行 ──────────────────────────────────────────────────────────────

function ToolRow({ tool }: { tool: { name: string, description: string } }) {
  return (
    <div className="flex gap-3 py-2">
      <span className="mt-0.5 shrink-0">
        <Wrench className="size-3.5 text-muted-foreground" />
      </span>
      <div className="min-w-0">
        <code className="text-xs font-mono font-semibold text-foreground">{tool.name}</code>
        {tool.description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{tool.description}</p>
        )}
      </div>
    </div>
  )
}

// ─── Skill 配置表单 ──────────────────────────────────────────────────────────

interface SkillConfigField {
  key: string
  type: 'string' | 'number' | 'boolean' | 'password' | 'select'
  label: string
  description?: string
  default?: unknown
  required?: boolean
  secret?: boolean
  options?: Array<{ value: string, label: string }>
}

function ConfigForm({
  skillName,
  fields,
  values,
}: {
  skillName: string
  fields: SkillConfigField[]
  values: Record<string, unknown>
}) {
  const { t } = useI18n()
  const [localValues, setLocalValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const f of fields) {
      const stored = values[f.key]
      init[f.key] = stored !== undefined ? String(stored) : (f.default !== undefined ? String(f.default) : '')
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
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <Settings2 className="size-3" />
        {t('settings.skills.card.config')}
      </h4>
      <div className="space-y-3">
        {fields.map(field => (
          <div key={field.key} className="space-y-1">
            <Label className="text-xs font-medium">
              {field.label}
              {field.required && <span className="text-destructive ml-0.5">*</span>}
            </Label>
            {field.description && (
              <p className="text-[11px] text-muted-foreground leading-snug">{field.description}</p>
            )}
            {field.type === 'boolean'
              ? (
                  <input
                    type="checkbox"
                    checked={localValues[field.key] === 'true'}
                    onChange={e => handleChange(field.key, String(e.target.checked))}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                )
              : field.type === 'select' && field.options
                ? (
                    <select
                      value={localValues[field.key]}
                      onChange={e => handleChange(field.key, e.target.value)}
                      className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      {!field.required && <option value="">{t('settings.skills.card.unset')}</option>}
                      {field.options.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  )
                : (
                    <Input
                      type={field.type === 'password' || field.secret ? 'password' : field.type === 'number' ? 'number' : 'text'}
                      value={localValues[field.key]}
                      placeholder={field.default !== undefined ? String(field.default) : ''}
                      onChange={e => handleChange(field.key, e.target.value)}
                      className="h-8 text-xs"
                    />
                  )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Skill 卡片 ──────────────────────────────────────────────────────────────

type Skill = Awaited<ReturnType<typeof trpcClient.skill.list>>[number]
type ExternalSkillSource = Awaited<ReturnType<typeof trpcClient.skill.externalSources>>[number]
type ConfigData = Awaited<ReturnType<typeof import('@/lib/config').getConfig>>

function SkillCard({
  skill,
  disabled,
  onToggleDisabled,
}: {
  skill: Skill
  disabled: boolean
  onToggleDisabled: (skillName: string, disabled: boolean) => void
}) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const hasDetails = skill.tools.length > 0 || skill.prompt || (skill.config?.length ?? 0) > 0 || skill.availableResourceDirs.length > 0 || skill.allDirEntries.length > 0

  const getSourceLabel = (sourceLabel: string) => {
    if (sourceLabel === 'builtin')
      return t('settings.skills.sourceLabels.builtin')
    if (sourceLabel === 'external')
      return t('settings.skills.sourceLabels.external')
    return sourceLabel
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* 顶部摘要行 */}
      <div
        className={`flex items-start gap-3 p-4 ${hasDetails ? 'cursor-pointer select-none hover:bg-muted/50 transition-colors' : ''}`}
        onClick={() => hasDetails && setExpanded(v => !v)}
      >
        <div className="mt-0.5 shrink-0 rounded-md border p-1.5 bg-background">
          <Package className="size-4 text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{skill.name}</span>
            <span className="text-xs text-muted-foreground">
              v
              {skill.version}
            </span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{getSourceLabel(skill.sourceLabel)}</Badge>
            {skill.toolCount > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {t('settings.skills.card.toolCount', { count: skill.toolCount })}
              </Badge>
            )}
            <Badge variant={disabled ? 'destructive' : 'secondary'} className="text-[10px] px-1.5 py-0">
              {disabled ? '已禁用' : '已启用'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 leading-snug">{skill.description}</p>
          <p className="text-[11px] text-muted-foreground mt-1 font-mono break-all">
            {t('settings.skills.card.sourcePath')}
            {skill.relativeSourcePath || skill.sourcePath}
          </p>
        </div>

        {hasDetails && (
          <span className="shrink-0 text-muted-foreground mt-1">
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </span>
        )}

        <div
          className="shrink-0"
          onClick={event => event.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">禁用</span>
            <Switch
              checked={disabled}
              onCheckedChange={checked => onToggleDisabled(skill.name, checked)}
            />
          </div>
        </div>
      </div>

      {/* 展开详情 */}
      {expanded && hasDetails && (
        <div className="border-t px-4 py-3 space-y-4 bg-muted/10">
          {/* 工具列表 */}
          {skill.tools.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <Wrench className="size-3" />
                {t('settings.skills.card.toolsCapability')}
              </h4>
              <div className="divide-y">
                {skill.tools.map(t => <ToolRow key={t.name} tool={t} />)}
              </div>
            </div>
          )}

          {/* 系统提示词 */}
          {skill.prompt && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
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

          {/* 来源与资源目录 */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <FolderTree className="size-3" />
              {t('settings.skills.card.sourceAndDirs')}
            </h4>
            <div className="space-y-2 text-xs">
              <p className="text-muted-foreground">
                {t('settings.skills.card.source')}
                <span className="font-medium text-foreground">{getSourceLabel(skill.sourceLabel)}</span>
              </p>
              <p className="text-muted-foreground break-all font-mono">{skill.sourcePath}</p>
              {skill.availableResourceDirs.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-1">{t('settings.skills.card.resourceDirs')}</p>
                  <div className="flex flex-wrap gap-1">
                    {skill.availableResourceDirs.map(dir => (
                      <Badge key={dir} variant="outline" className="text-[10px] px-1.5 py-0">{dir}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {skill.allDirEntries.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-1">{t('settings.skills.card.otherDirs')}</p>
                  <div className="flex flex-wrap gap-1">
                    {skill.allDirEntries.map(dir => (
                      <Badge key={dir} variant="outline" className="text-[10px] px-1.5 py-0">{dir}</Badge>
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
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
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

          {/* 配置表单 */}
          {(skill.config?.length ?? 0) > 0 && (
            <ConfigForm
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

// ─── 页面 ────────────────────────────────────────────────────────────────────

export function SkillsPage({
  skills,
  externalSources,
  config,
}: {
  skills: Skill[]
  externalSources: ExternalSkillSource[]
  config: ConfigData
}) {
  const { t } = useI18n()
  const [skillsState, setSkillsState] = useState(skills)
  const [externalSourcesState, setExternalSourcesState] = useState(externalSources)
  const [contextStrategy, setContextStrategy] = useState<'eager' | 'lazy'>(config.skillsContextStrategy ?? 'eager')
  const [disabledSkills, setDisabledSkills] = useState<string[]>(config.disabledSkills ?? [])
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [selectedExternalSource, setSelectedExternalSource] = useState(externalSources[0]?.path ?? '')
  const [isImportingExternal, setIsImportingExternal] = useState(false)

  const builtinSkills = skillsState.filter(s => s.isBuiltin)
  const userSkills = skillsState.filter(s => !s.isBuiltin)

  const refreshSkills = useCallback(async () => {
    const [nextSkills, nextExternalSources] = await Promise.all([
      trpcClient.skill.list(),
      trpcClient.skill.externalSources(),
    ])

    setSkillsState(nextSkills)
    setExternalSourcesState(nextExternalSources)
    setSelectedExternalSource((current) => {
      if (current && nextExternalSources.some(source => source.path === current))
        return current
      return nextExternalSources[0]?.path ?? ''
    })
  }, [])

  const handleContextStrategyChange = useCallback(async (value: 'eager' | 'lazy') => {
    setContextStrategy(value)
    await updateConfig('skillsContextStrategy', value)
    toast.success(t('skillsPage.context.toastUpdated'))
  }, [t])

  const handleToggleSkillDisabled = useCallback(async (skillName: string, disabled: boolean) => {
    const next = disabled
      ? Array.from(new Set([...disabledSkills, skillName]))
      : disabledSkills.filter(name => name !== skillName)

    setDisabledSkills(next)
    await updateConfig('disabledSkills', next)
    toast.success(disabled ? `已禁用 ${skillName}` : `已启用 ${skillName}`)
  }, [disabledSkills])

  const handleImportExternalSkills = useCallback(async () => {
    if (!selectedExternalSource) {
      toast.error(t('skillsPage.importExternal.selectRequired'))
      return
    }

    setIsImportingExternal(true)
    try {
      const result = await trpcClient.skill.importFromExternal({ sourcePath: selectedExternalSource })
      await refreshSkills()
      setImportDialogOpen(false)
      toast.success(t('skillsPage.importExternal.imported', { count: result.installed.length }))
    }
    catch (error) {
      toast.error(error instanceof Error ? error.message : t('skillsPage.importExternal.importFailed'))
    }
    finally {
      setIsImportingExternal(false)
    }
  }, [refreshSkills, selectedExternalSource, t])

  const storeSkills = [
    {
      id: 'writing-assistant',
      name: t('skillsPage.store.items.writing.name'),
      desc: t('skillsPage.store.items.writing.desc'),
      category: t('skillsPage.store.items.writing.category'),
    },
    {
      id: 'data-analyst',
      name: t('skillsPage.store.items.data.name'),
      desc: t('skillsPage.store.items.data.desc'),
      category: t('skillsPage.store.items.data.category'),
    },
    {
      id: 'frontend-helper',
      name: t('skillsPage.store.items.frontend.name'),
      desc: t('skillsPage.store.items.frontend.desc'),
      category: t('skillsPage.store.items.frontend.category'),
    },
  ]

  return (
    <div className="h-full overflow-y-auto w-full">
      <div className="max-w-6xl mx-auto p-6">
        {/* 页面头部 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">{t('skillsPage.title')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('skillsPage.description')}
          </p>
        </div>

        <Tabs defaultValue="installed" className="space-y-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="installed" className="gap-2">
              <Package className="h-4 w-4" />
              {t('skillsPage.tabs.installed')}
              {skillsState.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {skillsState.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="store" className="gap-2">
              <Sparkles className="h-4 w-4" />
              {t('skillsPage.tabs.store')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="installed" className="space-y-6 mt-6">
            <div className="flex justify-end">
              <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    {t('skillsPage.importExternal.open')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('skillsPage.importExternal.title')}</DialogTitle>
                    <DialogDescription>{t('skillsPage.importExternal.description')}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t('skillsPage.importExternal.sourceLabel')}</Label>
                      <Select value={selectedExternalSource} onValueChange={setSelectedExternalSource}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('skillsPage.importExternal.placeholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {externalSourcesState.map(source => (
                            <SelectItem key={source.path} value={source.path}>
                              {source.label}
                              {' '}
                              (
                              {source.skillCount}
                              )
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {externalSourcesState.length === 0 && (
                      <p className="text-sm text-muted-foreground">{t('skillsPage.importExternal.empty')}</p>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                        {t('skillsPage.importExternal.cancel')}
                      </Button>
                      <Button
                        onClick={handleImportExternalSkills}
                        disabled={isImportingExternal || externalSourcesState.length === 0}
                      >
                        {isImportingExternal ? t('skillsPage.importExternal.importing') : t('skillsPage.importExternal.confirm')}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Skills 上下文策略配置 */}
            <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-background p-6">
              <div className="flex items-start gap-4">
                <div className="shrink-0 rounded-lg border bg-background p-3 shadow-sm">
                  <Zap className="size-5 text-primary" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold">{t('skillsPage.context.title')}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('skillsPage.context.description')}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Label className="text-sm font-medium min-w-20">{t('skillsPage.context.modeLabel')}</Label>
                      <Select value={contextStrategy} onValueChange={handleContextStrategyChange}>
                        <SelectTrigger className="w-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="w-full">
                          <SelectItem value="eager">
                            <div className="flex flex-col gap-1 py-1 w-full">
                              <div className="flex items-center gap-2">
                                <Zap className="h-3.5 w-3.5" />
                                <span className="font-medium">{t('skillsPage.context.eagerTitle')}</span>
                                <span className="text-xs text-muted-foreground">{t('skillsPage.context.eagerDesc')}</span>
                              </div>

                            </div>
                          </SelectItem>
                          <SelectItem value="lazy">
                            <div className="flex flex-col gap-1 py-1 w-full">
                              <div className="flex items-center gap-2">
                                <Clock className="h-3.5 w-3.5" />
                                <span className="font-medium">{t('skillsPage.context.lazyTitle')}</span>
                                <span className="text-xs text-muted-foreground">{t('skillsPage.context.lazyDesc')}</span>
                              </div>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="rounded-lg bg-background/60 border p-4 text-sm space-y-2">
                      <div className="flex gap-2">
                        <div className="rounded-md bg-primary/10 p-1.5 mt-0.5">
                          <Zap className="h-3 w-3 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{t('skillsPage.context.eagerTitle')}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t('skillsPage.context.eagerTip')}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className="rounded-md bg-muted p-1.5 mt-0.5">
                          <Clock className="h-3 w-3" />
                        </div>
                        <div>
                          <p className="font-medium">{t('skillsPage.context.lazyTitle')}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t('skillsPage.context.lazyTip')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 技能列表 */}
            {skillsState.length === 0
              ? (
                  <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3 border-2 border-dashed rounded-xl">
                    <Package className="size-16 opacity-20" />
                    <div className="text-center">
                      <p className="text-base font-medium">{t('settings.skills.empty')}</p>
                      <p className="text-sm mt-1">前往商店安装 Skills</p>
                    </div>
                    <Button variant="outline" onClick={() => {}} className="gap-2">
                      <Sparkles className="h-4 w-4" />
                      浏览商店
                    </Button>
                  </div>
                )
              : (
                  <div className="space-y-8">
                    {/* 内置 Skills */}
                    {builtinSkills.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="h-px flex-1 bg-border" />
                          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-4">
                            {t('settings.skills.builtin')}
                          </h2>
                          <div className="h-px flex-1 bg-border" />
                        </div>
                        <div className="grid gap-4">
                          {builtinSkills.map(skill => (
                            <SkillCard
                              key={skill.name}
                              skill={skill}
                              disabled={disabledSkills.includes(skill.name)}
                              onToggleDisabled={handleToggleSkillDisabled}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 用户 Skills */}
                    {userSkills.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="h-px flex-1 bg-border" />
                          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-4">
                            {t('settings.skills.user')}
                          </h2>
                          <div className="h-px flex-1 bg-border" />
                        </div>
                        <div className="grid gap-4">
                          {userSkills.map(skill => (
                            <SkillCard
                              key={skill.name}
                              skill={skill}
                              disabled={disabledSkills.includes(skill.name)}
                              onToggleDisabled={handleToggleSkillDisabled}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
          </TabsContent>

          <TabsContent value="store" className="mt-6">
            <div className="space-y-6">
              {/* 商店头部 */}
              <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-background to-background p-8">
                <div className="flex items-center gap-3 mb-3">
                  <div className="rounded-lg bg-primary p-2.5">
                    <Sparkles className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <h2 className="text-2xl font-bold">{t('skillsPage.store.title')}</h2>
                </div>
                <p className="text-muted-foreground max-w-2xl">{t('skillsPage.store.description')}</p>
              </div>

              {/* 技能卡片网格 */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {storeSkills.map(skill => (
                  <article key={skill.id} className="group rounded-xl border bg-card p-5 flex flex-col gap-4 hover:shadow-lg hover:border-primary/50 transition-all duration-300">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="rounded-md bg-primary/10 p-1.5">
                            <Star className="h-3.5 w-3.5 text-primary fill-primary" />
                          </div>
                          <Badge variant="secondary" className="text-xs">{skill.category}</Badge>
                        </div>
                        <h3 className="font-semibold text-base group-hover:text-primary transition-colors">{skill.name}</h3>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-6 flex-1">{skill.desc}</p>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map(i => (
                          <Star
                            key={i}
                            className={`h-3.5 w-3.5 ${i <= 4 ? 'text-amber-500 fill-amber-500' : 'text-gray-300'}`}
                          />
                        ))}
                        <span className="text-xs text-muted-foreground ml-1.5">4.8</span>
                      </div>
                      <Button size="sm" className="gap-1.5 shadow-sm">
                        <Download className="h-3.5 w-3.5" />
                        {t('skillsPage.store.install')}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
