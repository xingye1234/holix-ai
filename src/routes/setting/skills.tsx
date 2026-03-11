import { createFileRoute, useRouter } from '@tanstack/react-router'
import { ChevronDown, ChevronRight, Clock, Code2, Info, Key, Lock, Package, Settings2, Terminal, Wrench } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { trpcClient } from '@/lib/trpc-client'

export const Route = createFileRoute('/setting/skills')({
  component: RouteComponent,
  loader: async () => {
    const skills = await trpcClient.skill.list()
    return { skills }
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
                <span>允许调用的模块</span>
              </div>
              {builtins.length === 0
                ? <span className="text-muted-foreground italic">无（完全隔离）</span>
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
                  <span>可读取的环境变量</span>
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
                超时
                {' '}
                {timeout >= 1000 ? `${timeout / 1000}s` : `${timeout}ms`}
              </span>
              <span className="flex items-center gap-1">
                <Terminal className="size-3" />
                内存上限
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
        配置
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
                      {!field.required && <option value="">（未设置）</option>}
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

function SkillCard({ skill }: { skill: Skill }) {
  const [expanded, setExpanded] = useState(false)
  const hasDetails = skill.tools.length > 0 || skill.declarations.length > 0 || skill.prompt || (skill.config?.length ?? 0) > 0

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
            {skill.isBuiltin && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">内置</Badge>
            )}
            {skill.toolCount > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {skill.toolCount}
                {' '}
                个工具
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1 leading-snug">{skill.description}</p>
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
                工具能力
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
                系统提示词扩展
              </h4>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap rounded-md border bg-muted/40 px-3 py-2 leading-relaxed font-mono">
                {skill.prompt}
              </pre>
            </div>
          )}

          {/* 权限 */}
          {skill.declarations.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <Lock className="size-3" />
                沙箱权限
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
  const { skills } = Route.useLoaderData()
  const [source, setSource] = useState('https://github.com/antfu/skills')
  const [path, setPath] = useState('')
  const [ref, setRef] = useState('')
  const [installing, setInstalling] = useState(false)

  const builtinSkills = skills.filter(s => s.isBuiltin)
  const userSkills = skills.filter(s => !s.isBuiltin)

  async function handleInstallFromGithub() {
    if (!source.trim()) {
      toast.error('请先输入 GitHub 仓库地址')
      return
    }

    setInstalling(true)
    try {
      const result = await trpcClient.skill.installFromGithub({
        source: source.trim(),
        path: path.trim() || undefined,
        ref: ref.trim() || undefined,
      })
      toast.success(`已安装 ${result.installed.length} 个 skill：${result.installed.join(', ')}`)
      await router.invalidate()
    }
    catch (error) {
      const message = error instanceof Error ? error.message : '安装失败'
      toast.error(message)
    }
    finally {
      setInstalling(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Skills</h1>
        <p className="text-muted-foreground mt-1">
          查看当前已加载的所有 Skills 及其工具能力、权限配置。
          共
          {' '}
          <strong>{skills.length}</strong>
          {' '}
          个 Skill（
          {builtinSkills.length}
          {' '}
          内置 /
          {userSkills.length}
          {' '}
          用户）。
        </p>
      </div>

      <div className="max-w-2xl rounded-lg border bg-card p-4 mb-6 space-y-3">
        <h2 className="text-sm font-semibold">从 GitHub 安装 Skills</h2>
        <p className="text-xs text-muted-foreground">
          支持仓库 URL（如 https://github.com/antfu/skills）或 owner/repo（如 antfu/skills）。
          也支持扫描来自其他产品的 skills 说明文件（如 SKILL.md / AGENTS.md / CLAUDE.md 等），
          并会自动读取本机目录（如 ~/.claude/skills）中的兼容 skills，在下方查看 skill 详情。
        </p>
        <div className="space-y-2">
          <Input value={source} onChange={e => setSource(e.target.value)} placeholder="https://github.com/owner/repo" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input value={path} onChange={e => setPath(e.target.value)} placeholder="skills（可选，默认 skills）" />
            <Input value={ref} onChange={e => setRef(e.target.value)} placeholder="main（可选）" />
          </div>
          <Button onClick={handleInstallFromGithub} disabled={installing}>
            {installing ? '安装中...' : '安装 Skill'}
          </Button>
        </div>
      </div>

      {skills.length === 0
        ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Package className="size-10 opacity-30" />
              <p className="text-sm">暂无加载的 Skills</p>
            </div>
          )
        : (
            <div className="max-w-2xl space-y-6">
              {/* 内置 Skills */}
              {builtinSkills.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    内置 Skills
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
                    用户 Skills
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
