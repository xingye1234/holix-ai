import type { Skill } from '@/routes/agents'
import { Bot, Brain, Cpu, Plus, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import ProviderModelSelector from '@/components/provider-model-selector'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MultiSelect } from '@/components/ui/multi-select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { useI18n } from '@/i18n/provider'

interface AgentDraft {
  name: string
  description: string
  prompt: string
  skills: string[]
  mcps: string[]
  provider: string
  model: string
  map: string
}

interface AgentItem extends AgentDraft {
  isBuiltin: boolean
}

const BUILTIN_AGENTS: AgentItem[] = [
  {
    name: 'General Assistant',
    description: 'Balanced default assistant for common Q&A and daily tasks.',
    prompt: 'You are a helpful and concise assistant.',
    skills: [],
    mcps: [],
    provider: '',
    model: '',
    map: '{"planning":0.6,"reasoning":0.6,"toolUse":0.5}',
    isBuiltin: true,
  },
  {
    name: 'Code Copilot',
    description: 'Focused on coding, debugging and code review tasks.',
    prompt: 'You are a senior software engineer helping with coding tasks.',
    skills: ['code-reader', 'file-system'],
    mcps: [],
    provider: '',
    model: '',
    map: '{"planning":0.7,"reasoning":0.9,"toolUse":0.8}',
    isBuiltin: true,
  },
]

function initialDraft(): AgentDraft {
  return {
    name: '',
    description: '',
    prompt: '',
    skills: [],
    mcps: [],
    provider: '',
    model: '',
    map: '{\n  "planning": 0.8,\n  "reasoning": 0.7,\n  "toolUse": 0.9\n}',
  }
}

function AgentCard({ agent }: { agent: AgentItem }) {
  const { t } = useI18n()

  return (
    <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <h3 className="font-medium leading-none">{agent.name}</h3>
          <p className="text-sm text-muted-foreground">{agent.description || t('agents.list.noDescription')}</p>
        </div>
        <Badge variant={agent.isBuiltin ? 'default' : 'secondary'}>
          {agent.isBuiltin ? t('agents.list.builtinBadge') : t('agents.list.customBadge')}
        </Badge>
      </div>

      <Separator />

      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('agents.form.skills')}</p>
        <div className="flex flex-wrap gap-2">
          {agent.skills.length > 0
            ? agent.skills.map(skill => <Badge key={skill} variant="secondary">{skill}</Badge>)
            : <span className="text-xs text-muted-foreground">{t('agents.list.noSkills')}</span>}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('agents.form.mcps')}</p>
        <div className="flex flex-wrap gap-2">
          {agent.mcps.length > 0
            ? agent.mcps.map(mcp => <Badge key={mcp} variant="secondary">{mcp}</Badge>)
            : <span className="text-xs text-muted-foreground">{t('agents.list.noMcps')}</span>}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('agents.form.model')}</p>
        <p className="text-sm text-muted-foreground">
          {agent.provider && agent.model
            ? `${agent.provider} / ${agent.model}`
            : t('agents.list.noModel')}
        </p>
      </div>
    </div>
  )
}

export function AgentsPage({ skills, mcpServers }: { skills: Skill[], mcpServers: string[] }) {
  const { t } = useI18n()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<AgentDraft>(initialDraft)
  const [customAgents, setCustomAgents] = useState<AgentItem[]>([])

  const skillOptions = useMemo(
    () => skills.map(skill => ({
      label: skill.name,
      value: skill.name,
    })),
    [skills],
  )

  const mcpOptions = useMemo(
    () => mcpServers.map(server => ({
      label: server,
      value: server,
    })),
    [mcpServers],
  )

  function updateField<K extends keyof AgentDraft>(key: K, value: AgentDraft[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function handleCreateAgent() {
    if (!form.name.trim()) {
      toast.error(t('agents.validation.nameRequired'))
      return
    }

    if (!form.prompt.trim()) {
      toast.error(t('agents.validation.promptRequired'))
      return
    }

    try {
      JSON.parse(form.map)
    }
    catch {
      toast.error(t('agents.validation.mapJsonInvalid'))
      return
    }

    const next: AgentItem = {
      name: form.name.trim(),
      description: form.description.trim(),
      prompt: form.prompt.trim(),
      skills: form.skills,
      mcps: form.mcps,
      provider: form.provider,
      model: form.model,
      map: form.map,
      isBuiltin: false,
    }

    setCustomAgents(prev => [next, ...prev])
    setForm(initialDraft())
    setDialogOpen(false)
    toast.success(t('agents.toast.created'))
  }

  return (
    <div className="w-full h-[calc(100vh-var(--app-header-height))] overflow-auto">
      <div className="w-full max-w-5xl mx-auto p-6 space-y-6">
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <Bot className="h-5 w-5" />
                <h1 className="text-xl font-semibold">{t('agents.title')}</h1>
              </div>
              <p className="text-sm text-muted-foreground">{t('agents.description')}</p>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t('agents.form.openCreate')}
                </Button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {t('agents.form.title')}
                  </DialogTitle>
                  <DialogDescription>{t('agents.form.dialogDescription')}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="agent-name">{t('agents.form.name')}</Label>
                      <Input
                        id="agent-name"
                        value={form.name}
                        onChange={e => updateField('name', e.target.value)}
                        placeholder={t('agents.form.namePlaceholder')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('agents.form.skills')}</Label>
                      <MultiSelect
                        options={skillOptions}
                        value={form.skills}
                        onChange={value => updateField('skills', value)}
                        placeholder={t('agents.form.skillsPlaceholder')}
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('agents.form.mcps')}</Label>
                    <MultiSelect
                      options={mcpOptions}
                      value={form.mcps}
                      onChange={value => updateField('mcps', value)}
                      placeholder={t('agents.form.mcpsPlaceholder')}
                      className="w-full"
                      disabled={mcpOptions.length === 0}
                    />
                    {mcpOptions.length === 0 && (
                      <p className="text-xs text-muted-foreground">{t('agents.form.noMcpHint')}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Cpu className="h-4 w-4" />
                      {t('agents.form.model')}
                    </Label>
                    <ProviderModelSelector
                      triggerOnInitialize
                      onProviderChange={provider => updateField('provider', provider)}
                      onModelChange={model => updateField('model', model)}
                      className="flex-wrap"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="agent-description">{t('agents.form.description')}</Label>
                    <Textarea
                      id="agent-description"
                      rows={3}
                      value={form.description}
                      onChange={e => updateField('description', e.target.value)}
                      placeholder={t('agents.form.descriptionPlaceholder')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="agent-prompt">{t('agents.form.prompt')}</Label>
                    <Textarea
                      id="agent-prompt"
                      rows={6}
                      value={form.prompt}
                      onChange={e => updateField('prompt', e.target.value)}
                      placeholder={t('agents.form.promptPlaceholder')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="agent-map" className="flex items-center gap-1.5">
                      <Brain className="h-4 w-4" />
                      {t('agents.form.map')}
                    </Label>
                    <Textarea
                      id="agent-map"
                      rows={6}
                      value={form.map}
                      onChange={e => updateField('map', e.target.value)}
                      placeholder={t('agents.form.mapPlaceholder')}
                      className="font-mono text-xs"
                    />
                    <p className="text-xs text-muted-foreground">{t('agents.form.mapHint')}</p>
                  </div>

                  <Button className="gap-2" onClick={handleCreateAgent}>
                    <Plus className="h-4 w-4" />
                    {t('agents.form.submit')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="text-base font-semibold">{t('agents.list.builtinTitle')}</h2>
          <div className="space-y-4">
            {BUILTIN_AGENTS.map(agent => (
              <AgentCard key={agent.name} agent={agent} />
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="text-base font-semibold">{t('agents.list.customTitle')}</h2>
          {customAgents.length === 0
            ? <p className="text-sm text-muted-foreground">{t('agents.list.emptyCustom')}</p>
            : (
                <div className="space-y-4">
                  {customAgents.map(agent => (
                    <AgentCard key={agent.name} agent={agent} />
                  ))}
                </div>
              )}
        </div>
      </div>
    </div>
  )
}
