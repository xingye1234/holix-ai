import { createFileRoute, useRouter } from '@tanstack/react-router'
import { ChevronDown, ChevronRight, Clock, Code2, FolderTree, Info, Key, Lock, Package, Settings2, Terminal, Wrench, Zap } from 'lucide-react'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { MarkdownRenderer } from '@/components/markdown/markdown-renderer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useI18n } from '@/i18n/provider'
import { getConfig, updateConfig } from '@/lib/config'
import { trpcClient } from '@/lib/trpc-client'

export const Route = createFileRoute('/setting/skills')({
  component: RouteComponent,
  loader: async () => {
    const skills = await trpcClient.skill.list()
    const config = await getConfig()
    return { skills, config }
  },
})

// ─── 权限标签 ────────────────────────────────────────────────────────────────

const RISK: Record<string, 'low' | 'medium' | 'high'> = {
  'path': 'low',
  'url': 'low',
  'util': 'low',
  'crypto': 'low',
  'os': 'low',
  'buffer': 'low',
  'events': 'low',
  'querystring': 'low',
  'node:path': 'low',
  'node:url': 'low',
  'node:util': 'low',
  'node:crypto': 'low',
  'node:os': 'low',
  'node:buffer': 'low',
  'fs': 'medium',
  'net': 'medium',
  'http': 'medium',
  'https': 'medium',
  'stream': 'medium',
  'dns': 'medium',
  'node:fs': 'medium',
  'node:net': 'medium',
  'node:http': 'medium',
  'child_process': 'high',
  'worker_threads': 'high',
  'cluster': 'high',
  'node:child_process': 'high',
  'node:worker_threads': 'high',
}

function riskColor(mod: string) {
  const r = RISK[mod] ?? 'medium'
  if (r === 'low')
    return 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-800'
  if (r === 'high')
    return 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800'
  return 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800'
}

// ─── 单个工具行 ──────────────────────────────────────────────────────────────

function ToolRow({ tool }: { tool: { name: string, description: string } }) {
  return (
    <div className="flex gap-3 py-2">
      <span className="mt-0.5 shrink-0">
        <Wrench className="size-3.5 text-muted-foreground" />
      </span>
      <div className="min-w-0">
        <code className="text-xs font-mono font-semibold text-foreground">{tool.name}</code>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{tool.description}</p>
      </div>
    </div>
  )
}

// ─── 权限面板 ────────────────────────────────────────────────────────────────

interface Declaration {
  type: string
  file?: string
  permissions?: {
    allowedBuiltins?: string[]
    allowedEnvKeys?: string[]
    timeout?: number
    memoryLimitMb?: number
  }
}

function PermissionsPanel({ declarations }: { declarations: Declaration[] }) {
  const { t } = useI18n()
  const jsDecs = declarations.filter(d => d.type === 'js')
  if (!jsDecs.length)
    return null

  return (
    <div className="space-y-3">
      {jsDecs.map((dec, i) => {
        const p = dec.permissions ?? {}
        const builtins = p.allowedBuiltins ?? []
        const envKeys = p.allowedEnvKeys ?? []
        const timeout = p.timeout ?? 10000
        const mem = p.memoryLimitMb ?? 64

        return (
          <div key={i} className="rounded-md border bg-muted/30 px-3 py-2.5 space-y-2.5 text-xs">
            {dec.file && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Code2 className="size-3" />
                <span className="font-mono">{dec.file}</span>
              </div>
            )}

            {/* 允许的内置模块 */}
            <div>
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
                <Lock className="size-3" />
                <span>{t('settings.skills.permissions.allowedModules')}</span>
              </div>
              {builtins.length === 0
                ? <span className="text-muted-foreground italic">{t('settings.skills.permissions.noModules')}</span>
                : (
                    <div className="flex flex-wrap gap-1">
                      {builtins.map(m => (
                        <span
                          key={m}
                          className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[11px] ${riskColor(m)}`}
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
            </div>

            {/* 环境变量 */}
            {envKeys.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
                  <Key className="size-3" />
                  <span>{t('settings.skills.permissions.envKeys')}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {envKeys.map(k => (
                    <span key={k} className="inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[11px] text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 超时 & 内存 */}
            <div className="flex items-center gap-4 text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {t('settings.skills.permissions.timeout')}
                {' '}
                {timeout >= 1000 ? `${timeout / 1000}s` : `${timeout}ms`}
              </span>
              <span className="flex items-center gap-1">
                <Terminal className="size-3" />
                {t('settings.skills.permissions.memoryLimit')}
                {' '}
                {mem}
                MB
              </span>
            </div>
          </div>
        )
      })}
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

const SOURCE_LABEL_MAP: Record<string, string> = {
  'builtin': '内置',
  'external': '外部目录',
  '.holixai': '.holixai',
  '.holix': '.holix',
  '.codex': '.codex',
  '.claude': '.claude',
  '.cursor': '.cursor',
  '.gemini': '.gemini',
  '.qwen': '.qwen',
  '.kiro': '.kiro',
}

function SkillCard({ skill }: { skill: Skill }) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const hasDetails = skill.tools.length > 0 || skill.declarations.length > 0 || skill.prompt || (skill.config?.length ?? 0) > 0 || skill.availableResourceDirs.length > 0 || skill.allDirEntries.length > 0

  const getSourceLabel = (sourceLabel: string) => {
    if (sourceLabel === 'builtin') return t('settings.skills.sourceLabels.builtin')
    if (sourceLabel === 'external') return t('settings.skills.sourceLabels.external')
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

          {/* 权限 */}
          {skill.declarations.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <Lock className="size-3" />
                {t('settings.skills.card.sandboxPermissions')}
              </h4>
              <PermissionsPanel declarations={skill.declarations as Declaration[]} />
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

function RouteComponent() {
  const router = useRouter()
  const { skills, config } = Route.useLoaderData()
  const { t } = useI18n()
  const [source, setSource] = useState('https://github.com/antfu/skills')
  const [path, setPath] = useState('')
  const [ref, setRef] = useState('')
  const [installing, setInstalling] = useState(false)
  const [contextStrategy, setContextStrategy] = useState<'eager' | 'lazy'>(config.skillsContextStrategy ?? 'eager')

  const builtinSkills = skills.filter(s => s.isBuiltin)
  const userSkills = skills.filter(s => !s.isBuiltin)

  const handleContextStrategyChange = useCallback(async (value: 'eager' | 'lazy') => {
    setContextStrategy(value)
    await updateConfig('skillsContextStrategy', value)
    toast.success('Skills 上下文策略已更新，将在下次对话时生效')
  }, [])

  async function handleInstallFromGithub() {
    if (!source.trim()) {
      toast.error(t('settings.skills.install.errorNoRepo'))
      return
    }

    setInstalling(true)
    try {
      const result = await trpcClient.skill.installFromGithub({
        source: source.trim(),
        path: path.trim() || undefined,
        ref: ref.trim() || undefined,
      })
      toast.success(t('settings.skills.install.successInstalled', { count: result.installed.length, names: result.installed.join(', ') }))
      await router.invalidate()
    }
    catch (error) {
      const message = error instanceof Error ? error.message : t('settings.skills.install.errorInstall')
      toast.error(message)
    }
    finally {
      setInstalling(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('settings.skills.title')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('settings.skills.description')}
          {t('settings.skills.count', { total: skills.length, builtin: builtinSkills.length, user: userSkills.length })}
        </p>
      </div>

      {/* Skills 上下文策略配置 */}
      <div className="max-w-2xl rounded-lg border bg-card p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0 rounded-md border p-1.5 bg-background">
            <Zap className="size-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold mb-1">Skills 上下文策略</h2>
            <p className="text-xs text-muted-foreground mb-3">
              控制 AI 在聊天时如何感知 skills 信息
            </p>
            <div className="flex items-center gap-3">
              <Label className="text-sm">加载方式：</Label>
              <Select value={contextStrategy} onValueChange={handleContextStrategyChange}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="eager">
                    <div className="flex flex-col">
                      <span className="font-medium">急迫加载</span>
                      <span className="text-xs text-muted-foreground">AI 直接看到所有 skills 的完整信息</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="lazy">
                    <div className="flex flex-col">
                      <span className="font-medium">渐进式加载</span>
                      <span className="text-xs text-muted-foreground">AI 先看摘要，需要时再查看详情</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="mt-3 text-xs text-muted-foreground space-y-1">
              <p>• <strong>急迫加载</strong>：AI 在聊天开始时就能看到所有 skills 的完整提示词，可以直接使用</p>
              <p>• <strong>渐进式加载</strong>：AI 只看到 skills 的名称和描述，需要时通过工具查看详情，节省 token</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl rounded-lg border bg-card p-4 mb-6 space-y-3">
        <h2 className="text-sm font-semibold">{t('settings.skills.install.title')}</h2>
        <p className="text-xs text-muted-foreground">
          {t('settings.skills.install.description')}
        </p>
        <div className="space-y-2">
          <Input value={source} onChange={e => setSource(e.target.value)} placeholder={t('settings.skills.install.repoPlaceholder')} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input value={path} onChange={e => setPath(e.target.value)} placeholder={t('settings.skills.install.pathPlaceholder')} />
            <Input value={ref} onChange={e => setRef(e.target.value)} placeholder={t('settings.skills.install.refPlaceholder')} />
          </div>
          <Button onClick={handleInstallFromGithub} disabled={installing}>
            {installing ? t('settings.skills.install.installing') : t('settings.skills.install.button')}
          </Button>
        </div>
      </div>

      {skills.length === 0
        ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Package className="size-10 opacity-30" />
              <p className="text-sm">{t('settings.skills.empty')}</p>
            </div>
          )
        : (
            <div className="max-w-2xl space-y-6">
              {/* 内置 Skills */}
              {builtinSkills.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {t('settings.skills.builtin')}
                  </h2>
                  {builtinSkills.map(skill => (
                    <SkillCard key={skill.name} skill={skill} />
                  ))}
                </div>
              )}

              {builtinSkills.length > 0 && userSkills.length > 0 && (
                <Separator />
              )}

              {/* 用户 Skills */}
              {userSkills.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {t('settings.skills.user')}
                  </h2>
                  {userSkills.map(skill => (
                    <SkillCard key={skill.name} skill={skill} />
                  ))}
                </div>
              )}
            </div>
          )}
    </div>
  )
}
