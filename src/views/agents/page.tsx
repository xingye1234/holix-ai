import {
  Bot,
  Brain,
  Copy,
  Download,
  Heart,
  Import,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Star,
  Trash2,
  Upload,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MultiSelect } from '@/components/ui/multi-select'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useI18n } from '@/i18n/provider'
import { trpcClient } from '@/lib/trpc-client'
import ProviderModelSelector from '@/views/shared/provider-model-selector'

interface Skill {
  name: string
  description: string
}

interface AgentData {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  prompt: string
  skills: string[]
  mcps: string[]
  provider: string
  model: string
  variables: any[]
  map: Record<string, number>
  isBuiltin: boolean
  favorite?: boolean
  useCount?: number
  lastUsedAt?: number | null
}

interface AgentDraft {
  name: string
  description: string
  category: string
  tags: string[]
  prompt: string
  skills: string[]
  mcps: string[]
  provider: string
  model: string
  map: string
}

function initialDraft(): AgentDraft {
  return {
    name: '',
    description: '',
    category: 'general',
    tags: [],
    prompt: '',
    skills: [],
    mcps: [],
    provider: '',
    model: '',
    map: JSON.stringify({ planning: 0.8, reasoning: 0.7, toolUse: 0.9 }, null, 2),
  }
}

function AgentCard({
  agent,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleFavorite,
  onExport,
}: {
  agent: AgentData
  onEdit: (agent: AgentData) => void
  onDelete: (agent: AgentData) => void
  onDuplicate: (agent: AgentData) => void
  onToggleFavorite: (agent: AgentData) => void
  onExport: (agent: AgentData) => void
}) {
  const { t } = useI18n()

  return (
    <div className="rounded-lg border p-4 space-y-3 bg-muted/20 group hover:bg-muted/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium leading-none">{agent.name}</h3>
            <Badge variant={agent.isBuiltin ? 'default' : 'secondary'}>
              {agent.isBuiltin ? t('agents.list.builtinBadge') : t('agents.list.customBadge')}
            </Badge>
            {agent.favorite && (
              <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">{agent.description || t('agents.list.noDescription')}</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(agent)}>
              <Settings2 className="h-4 w-4 mr-2" />
              {t('agents.list.edit')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggleFavorite(agent)}>
              <Heart className="h-4 w-4 mr-2" />
              {agent.favorite ? t('agents.list.unfavorite') : t('agents.list.favorite')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate(agent)}>
              <Copy className="h-4 w-4 mr-2" />
              {t('agents.list.duplicate')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport(agent)}>
              <Download className="h-4 w-4 mr-2" />
              {t('agents.list.export')}
            </DropdownMenuItem>
            {!agent.isBuiltin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDelete(agent)} className="text-red-600">
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('agents.list.delete')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('agents.form.skills')}</p>
          {agent.useCount !== undefined && agent.useCount > 0 && (
            <p className="text-xs text-muted-foreground">{t('agents.list.usedTimes', { count: agent.useCount })}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {agent.skills.length > 0
            ? agent.skills.map(skill => <Badge key={skill} variant="secondary">{skill}</Badge>)
            : <span className="text-xs text-muted-foreground">{t('agents.list.noSkills')}</span>}
        </div>
      </div>

      {agent.tags.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('agents.form.tags')}</p>
          <div className="flex flex-wrap gap-2">
            {agent.tags.map(tag => <Badge key={tag} variant="outline">{tag}</Badge>)}
          </div>
        </div>
      )}

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

export function AgentsPage({
  initialAgents = [],
  skills = [],
  mcpServers = [],
}: {
  initialAgents?: AgentData[]
  skills?: Skill[]
  mcpServers?: string[]
}) {
  const { t } = useI18n()
  const [agents, setAgents] = useState<AgentData[]>(initialAgents)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'name' | 'created' | 'lastUsed' | 'useCount'>('name')
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)

  // Form states
  const [createForm, setCreateForm] = useState<AgentDraft>(initialDraft)
  const [editForm, setEditForm] = useState<AgentDraft>(initialDraft)
  const [selectedAgent, setSelectedAgent] = useState<AgentData | null>(null)
  const [importJson, setImportJson] = useState('')

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

  const categories = useMemo(() => {
    const cats = new Set(agents.map(a => a.category))
    return Array.from(cats).sort()
  }, [agents])

  // Load agents
  const loadAgents = useCallback(async () => {
    setLoading(true)
    try {
      const result = await trpcClient.agent.list()
      setAgents(result)
    }
    catch (error) {
      toast.error(t('agents.toast.loadFailed'))
      console.error('Failed to load agents:', error)
    }
    finally {
      setLoading(false)
    }
  }, [t])

  // Initial load
  useEffect(() => {
    if (initialAgents.length === 0) {
      loadAgents()
    }
  }, [])

  // Filter and sort agents
  const filteredAgents = useMemo(() => {
    let result = [...agents]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(agent =>
        agent.name.toLowerCase().includes(query)
        || agent.description.toLowerCase().includes(query)
        || agent.tags.some(tag => tag.toLowerCase().includes(query)),
      )
    }

    // Category filter
    if (selectedCategory !== 'all') {
      result = result.filter(agent => agent.category === selectedCategory)
    }

    // Favorites filter
    if (showFavoritesOnly) {
      result = result.filter(agent => agent.favorite)
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'created':
          return 0 // Not available in current schema
        case 'lastUsed':
          if (!a.lastUsedAt)
            return 1
          if (!b.lastUsedAt)
            return -1
          return b.lastUsedAt - a.lastUsedAt
        case 'useCount':
          return (b.useCount || 0) - (a.useCount || 0)
        default:
          return 0
      }
    })

    return result
  }, [agents, searchQuery, selectedCategory, showFavoritesOnly, sortBy])

  // Helper functions
  const updateFormField = <K extends keyof AgentDraft>(key: K, value: AgentDraft[K]) => {
    if (createDialogOpen) {
      setCreateForm(prev => ({ ...prev, [key]: value }))
    }
    else {
      setEditForm(prev => ({ ...prev, [key]: value }))
    }
  }

  const handleCreateAgent = async () => {
    if (!createForm.name.trim()) {
      toast.error(t('agents.validation.nameRequired'))
      return
    }

    if (!createForm.prompt.trim()) {
      toast.error(t('agents.validation.promptRequired'))
      return
    }

    try {
      JSON.parse(createForm.map)
    }
    catch {
      toast.error(t('agents.validation.mapJsonInvalid'))
      return
    }

    try {
      const map = JSON.parse(createForm.map)
      await trpcClient.agent.create({
        name: createForm.name.trim(),
        description: createForm.description.trim(),
        category: createForm.category,
        tags: createForm.tags,
        prompt: createForm.prompt.trim(),
        skills: createForm.skills,
        mcps: createForm.mcps,
        provider: createForm.provider,
        model: createForm.model,
        map,
      })

      await loadAgents()
      setCreateForm(initialDraft())
      setCreateDialogOpen(false)
      toast.success(t('agents.toast.created'))
    }
    catch (error: any) {
      toast.error(error.message || t('agents.toast.createFailed'))
    }
  }

  const handleUpdateAgent = async () => {
    if (!selectedAgent)
      return

    try {
      JSON.parse(editForm.map)
    }
    catch {
      toast.error(t('agents.validation.mapJsonInvalid'))
      return
    }

    try {
      const map = JSON.parse(editForm.map)
      await trpcClient.agent.update({
        name: selectedAgent.name,
        updates: {
          description: editForm.description,
          category: editForm.category,
          tags: editForm.tags,
          prompt: editForm.prompt,
          skills: editForm.skills,
          mcps: editForm.mcps,
          provider: editForm.provider,
          model: editForm.model,
          map,
        },
      })

      await loadAgents()
      setEditDialogOpen(false)
      setSelectedAgent(null)
      toast.success(t('agents.toast.updated'))
    }
    catch (error: any) {
      toast.error(error.message || t('agents.toast.updateFailed'))
    }
  }

  const handleDeleteAgent = async () => {
    if (!selectedAgent)
      return

    try {
      await trpcClient.agent.delete({ name: selectedAgent.name })
      await loadAgents()
      setDeleteDialogOpen(false)
      setSelectedAgent(null)
      toast.success(t('agents.toast.deleted'))
    }
    catch (error: any) {
      toast.error(error.message || t('agents.toast.deleteFailed'))
    }
  }

  const handleDuplicateAgent = async (agent: AgentData) => {
    const newName = `${agent.name} (Copy)`
    try {
      await trpcClient.agent.duplicate({
        name: agent.name,
        newName,
      })
      await loadAgents()
      toast.success(t('agents.toast.duplicated'))
    }
    catch (error: any) {
      toast.error(error.message || t('agents.toast.duplicateFailed'))
    }
  }

  const handleToggleFavorite = async (agent: AgentData) => {
    try {
      await trpcClient.agent.toggleFavorite({ name: agent.name })
      await loadAgents()
    }
    catch (error: any) {
      toast.error(error.message || t('agents.toast.toggleFavoriteFailed'))
    }
  }

  const handleExportAgent = async (agent: AgentData) => {
    try {
      const result = await trpcClient.agent.export({ name: agent.name })
      const blob = new Blob([result.json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${agent.name}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(t('agents.toast.exported'))
    }
    catch (error: any) {
      toast.error(error.message || t('agents.toast.exportFailed'))
    }
  }

  const handleImportAgent = async () => {
    try {
      JSON.parse(importJson) // validate JSON before sending
      await trpcClient.agent.import({ json: importJson })
      await loadAgents()
      setImportJson('')
      setImportDialogOpen(false)
      toast.success(t('agents.toast.imported'))
    }
    catch (error: any) {
      toast.error(error.message || t('agents.toast.importFailed'))
    }
  }

  const handleEditAgent = (agent: AgentData) => {
    setSelectedAgent(agent)
    setEditForm({
      name: agent.name,
      description: agent.description,
      category: agent.category,
      tags: agent.tags,
      prompt: agent.prompt,
      skills: agent.skills,
      mcps: agent.mcps,
      provider: agent.provider,
      model: agent.model,
      map: JSON.stringify(agent.map, null, 2),
    })
    setEditDialogOpen(true)
  }

  const builtinAgents = filteredAgents.filter(a => a.isBuiltin)
  const customAgents = filteredAgents.filter(a => !a.isBuiltin)

  return (
    <div className="h-full w-full overflow-auto">
      <div className="w-full max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <Bot className="h-5 w-5" />
                <h1 className="text-xl font-semibold">{t('agents.title')}</h1>
              </div>
              <p className="text-sm text-muted-foreground">{t('agents.description')}</p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setImportDialogOpen(true)
                  setImportJson('')
                }}
                title={t('agents.list.import')}
              >
                <Upload className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={loadAgents}
                disabled={loading}
                title={t('agents.list.refresh')}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
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
                          value={createForm.name}
                          onChange={e => updateFormField('name', e.target.value)}
                          placeholder={t('agents.form.namePlaceholder')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('agents.form.category')}</Label>
                        <Select
                          value={createForm.category}
                          onValueChange={value => updateFormField('category', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="general">General</SelectItem>
                            <SelectItem value="development">Development</SelectItem>
                            <SelectItem value="writing">Writing</SelectItem>
                            <SelectItem value="productivity">Productivity</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t('agents.form.skills')}</Label>
                        <MultiSelect
                          options={skillOptions}
                          value={createForm.skills}
                          onChange={value => updateFormField('skills', value)}
                          placeholder={t('agents.form.skillsPlaceholder')}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('agents.form.mcps')}</Label>
                        <MultiSelect
                          options={mcpOptions}
                          value={createForm.mcps}
                          onChange={value => updateFormField('mcps', value)}
                          placeholder={t('agents.form.mcpsPlaceholder')}
                          className="w-full"
                          disabled={mcpOptions.length === 0}
                        />
                        {mcpOptions.length === 0 && (
                          <p className="text-xs text-muted-foreground">{t('agents.form.noMcpHint')}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Settings2 className="h-4 w-4" />
                        {t('agents.form.model')}
                      </Label>
                      <ProviderModelSelector
                        triggerOnInitialize
                        onProviderChange={provider => updateFormField('provider', provider)}
                        onModelChange={model => updateFormField('model', model)}
                        className="flex-wrap"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="agent-description">{t('agents.form.description')}</Label>
                      <Textarea
                        id="agent-description"
                        rows={2}
                        value={createForm.description}
                        onChange={e => updateFormField('description', e.target.value)}
                        placeholder={t('agents.form.descriptionPlaceholder')}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="agent-prompt">{t('agents.form.prompt')}</Label>
                      <Textarea
                        id="agent-prompt"
                        rows={6}
                        value={createForm.prompt}
                        onChange={e => updateFormField('prompt', e.target.value)}
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
                        rows={4}
                        value={createForm.map}
                        onChange={e => updateFormField('map', e.target.value)}
                        placeholder={t('agents.form.mapPlaceholder')}
                        className="font-mono text-xs"
                      />
                      <p className="text-xs text-muted-foreground">{t('agents.form.mapHint')}</p>
                    </div>

                    <Button className="gap-2 w-full" onClick={handleCreateAgent}>
                      <Plus className="h-4 w-4" />
                      {t('agents.form.submit')}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('agents.list.searchPlaceholder')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('agents.list.allCategories')}</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">{t('agents.list.sortByName')}</SelectItem>
                <SelectItem value="lastUsed">{t('agents.list.sortByLastUsed')}</SelectItem>
                <SelectItem value="useCount">{t('agents.list.sortByUseCount')}</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant={showFavoritesOnly ? 'default' : 'outline'}
              size="icon"
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              title={t('agents.list.showFavorites')}
            >
              <Star className={`h-4 w-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Built-in Agents */}
        {builtinAgents.length > 0 && (
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h2 className="text-base font-semibold">{t('agents.list.builtinTitle')}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {builtinAgents.map(agent => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onEdit={handleEditAgent}
                  onDelete={() => {
                    setSelectedAgent(agent)
                    setDeleteDialogOpen(true)
                  }}
                  onDuplicate={handleDuplicateAgent}
                  onToggleFavorite={handleToggleFavorite}
                  onExport={handleExportAgent}
                />
              ))}
            </div>
          </div>
        )}

        {/* Custom Agents */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="text-base font-semibold">{t('agents.list.customTitle')}</h2>
          {customAgents.length === 0
            ? <p className="text-sm text-muted-foreground">{t('agents.list.emptyCustom')}</p>
            : (
                <div className="grid gap-4 md:grid-cols-2">
                  {customAgents.map(agent => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      onEdit={handleEditAgent}
                      onDelete={() => {
                        setSelectedAgent(agent)
                        setDeleteDialogOpen(true)
                      }}
                      onDuplicate={handleDuplicateAgent}
                      onToggleFavorite={handleToggleFavorite}
                      onExport={handleExportAgent}
                    />
                  ))}
                </div>
              )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              {t('agents.form.editTitle')}
              {' '}
              -
              {selectedAgent?.name}
            </DialogTitle>
            <DialogDescription>{t('agents.form.editDialogDescription')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('agents.form.category')}</Label>
                <Select
                  value={editForm.category}
                  onValueChange={value => updateFormField('category', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="development">Development</SelectItem>
                    <SelectItem value="writing">Writing</SelectItem>
                    <SelectItem value="productivity">Productivity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">{t('agents.form.description')}</Label>
              <Textarea
                id="edit-description"
                rows={2}
                value={editForm.description}
                onChange={e => updateFormField('description', e.target.value)}
                placeholder={t('agents.form.descriptionPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-prompt">{t('agents.form.prompt')}</Label>
              <Textarea
                id="edit-prompt"
                rows={6}
                value={editForm.prompt}
                onChange={e => updateFormField('prompt', e.target.value)}
                placeholder={t('agents.form.promptPlaceholder')}
              />
            </div>

            <Button className="gap-2 w-full" onClick={handleUpdateAgent}>
              <Sparkles className="h-4 w-4" />
              {t('agents.form.updateSubmit')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('agents.list.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('agents.list.deleteConfirmation', { name: selectedAgent?.name })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t('agents.list.deleteCancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteAgent}>
              {t('agents.list.deleteConfirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Import className="h-4 w-4 text-primary" />
              {t('agents.list.importDialogTitle')}
            </DialogTitle>
            <DialogDescription>{t('agents.list.importDialogDescription')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="import-json">{t('agents.list.importJsonLabel')}</Label>
              <Textarea
                id="import-json"
                rows={10}
                value={importJson}
                onChange={e => setImportJson(e.target.value)}
                placeholder={t('agents.list.importJsonPlaceholder')}
                className="font-mono text-xs"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                {t('agents.list.importCancel')}
              </Button>
              <Button onClick={handleImportAgent} disabled={!importJson.trim()}>
                <Import className="h-4 w-4 mr-2" />
                {t('agents.list.importSubmit')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
