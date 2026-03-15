import type { AIProvider } from '@/types/provider'
import type { VendorPreset } from '@/lib/model-presets'
import { createFileRoute } from '@tanstack/react-router'
import { Pencil, Plus, Star } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { TagInput } from '@/components/ui/tag-input'
import { useI18n } from '@/i18n/provider'
import { ALL_MODELS, VENDOR_PRESETS } from '@/lib/model-presets'
import {
  addProvider,
  getDefaultProvider,
  getProviders,
  removeProvider,
  setDefaultProvider,
  updateProvider,
} from '@/lib/provider'

export const Route = createFileRoute('/setting/provider')({
  component: RouteComponent,
  loader: async () => {
    const [providers, defaultProvider] = await Promise.all([getProviders(), getDefaultProvider()])
    return { providers, defaultProvider }
  },
})

// ─── Helper ────────────────────────────────────────────────────────────────

function getHostname(url: string): string {
  try {
    return new URL(url).hostname
  }
  catch {
    return url
  }
}

// ─── ProviderFormDialog ────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '',
  avatar: '🤖',
  baseUrl: '',
  apiKey: '',
  models: [] as string[],
}

interface ProviderFormDialogProps {
  mode: 'add' | 'edit'
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: AIProvider
  onAdd?: (provider: AIProvider) => void
  onUpdate?: (name: string, updates: Partial<AIProvider>) => void
  onDelete?: (name: string) => void
}

function ProviderFormDialog({
  mode,
  open,
  onOpenChange,
  initialData,
  onAdd,
  onUpdate,
  onDelete,
}: ProviderFormDialogProps) {
  const { t } = useI18n()

  const [form, setForm] = useState(EMPTY_FORM)
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null)
  const [deletePopoverOpen, setDeletePopoverOpen] = useState(false)

  useEffect(() => {
    if (!open)
      return
    if (mode === 'edit' && initialData) {
      setForm({
        name: initialData.name,
        avatar: initialData.avatar || '🤖',
        baseUrl: initialData.baseUrl,
        apiKey: initialData.apiKey,
        models: initialData.models,
      })
    }
    else {
      setForm(EMPTY_FORM)
    }
    setSelectedVendorId(null)
    setDeletePopoverOpen(false)
  }, [open, mode, initialData])

  function handleVendorChip(vendor: VendorPreset) {
    setSelectedVendorId(vendor.id)
    setForm(prev => ({
      ...prev,
      ...(mode === 'add' ? { name: vendor.name } : {}),
      avatar: vendor.avatar,
      baseUrl: vendor.baseUrl,
      models: vendor.models,
    }))
  }

  function handleFieldChange(field: 'name' | 'avatar' | 'baseUrl', value: string) {
    setSelectedVendorId(null)
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleSave() {
    if (mode === 'add') {
      onAdd?.({
        name: form.name,
        avatar: form.avatar,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey,
        models: form.models,
        enabled: false,
      })
    }
    else {
      onUpdate?.(initialData!.name, {
        avatar: form.avatar,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey,
        models: form.models,
      })
    }
    onOpenChange(false)
  }

  const isValid = form.name.trim() !== '' && form.baseUrl.trim() !== ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit'
              ? t('settings.provider.editDialog.title')
              : t('settings.provider.addDialog.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Vendor preset chips */}
          <div className="space-y-2">
            <Label>{t('settings.provider.vendorPresetLabel')}</Label>
            <div className="flex flex-wrap gap-2">
              {VENDOR_PRESETS.map(vendor => (
                <Button
                  key={vendor.id}
                  type="button"
                  variant={selectedVendorId === vendor.id ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => handleVendorChip(vendor)}
                >
                  {vendor.avatar}
                  {' '}
                  {vendor.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="dialog-name">
              {t('settings.provider.addDialog.nameLabel')}
              {' '}
              *
            </Label>
            {mode === 'add'
              ? (
                  <Input
                    id="dialog-name"
                    value={form.name}
                    onChange={e => handleFieldChange('name', e.target.value)}
                    placeholder={t('settings.provider.addDialog.namePlaceholder')}
                  />
                )
              : (
                  <p id="dialog-name" className="py-1 text-sm">
                    {form.name}
                  </p>
                )}
          </div>

          {/* Avatar */}
          <div className="space-y-2">
            <Label htmlFor="dialog-avatar">{t('settings.provider.addDialog.avatarLabel')}</Label>
            <Input
              id="dialog-avatar"
              value={form.avatar}
              onChange={e => handleFieldChange('avatar', e.target.value)}
              maxLength={2}
              placeholder={t('settings.provider.addDialog.avatarPlaceholder')}
            />
          </div>

          {/* Base URL */}
          <div className="space-y-2">
            <Label htmlFor="dialog-baseUrl">Base URL *</Label>
            <Input
              id="dialog-baseUrl"
              type="url"
              value={form.baseUrl}
              onChange={e => handleFieldChange('baseUrl', e.target.value)}
              placeholder="https://api.example.com/v1"
            />
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="dialog-apiKey">API Key</Label>
            <Input
              id="dialog-apiKey"
              type="password"
              value={form.apiKey}
              onChange={e => setForm(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder={t('settings.provider.apiKeyPlaceholder')}
            />
          </div>

          {/* Models */}
          <div className="space-y-2">
            <Label>{t('settings.provider.modelsLabel')}</Label>
            <TagInput
              value={form.models}
              suggestions={ALL_MODELS}
              onChange={models => setForm(prev => ({ ...prev, models }))}
            />
          </div>
        </div>

        <DialogFooter className="flex-row items-center">
          {mode === 'edit' && (
            <Popover open={deletePopoverOpen} onOpenChange={setDeletePopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="destructive" size="sm" className="mr-auto">
                  {t('settings.provider.deleteButton')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-4">
                  <p className="text-sm">{t('settings.provider.deleteConfirmation')}</p>
                  <div className="flex justify-end">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        onDelete?.(initialData!.name)
                        setDeletePopoverOpen(false)
                        onOpenChange(false)
                      }}
                    >
                      {t('settings.provider.confirmDelete')}
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('settings.provider.addDialog.cancelButton')}
          </Button>
          <Button onClick={handleSave} disabled={!isValid}>
            {mode === 'edit'
              ? t('settings.provider.editDialog.saveButton')
              : t('settings.provider.addDialog.addButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── RouteComponent ────────────────────────────────────────────────────────

function RouteComponent() {
  const { t } = useI18n()
  const { providers: initialProviders, defaultProvider: initialDefaultProvider } = Route.useLoaderData()
  const [providers, setProviders] = useState<AIProvider[]>(initialProviders)
  const [defaultProviderState, setDefaultProviderState] = useState(
    initialDefaultProvider || providers[0]?.name || '',
  )

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add')
  const [editingProvider, setEditingProvider] = useState<AIProvider | undefined>()

  function openAddDialog() {
    setDialogMode('add')
    setEditingProvider(undefined)
    setDialogOpen(true)
  }

  function openEditDialog(provider: AIProvider) {
    setDialogMode('edit')
    setEditingProvider(provider)
    setDialogOpen(true)
  }

  const handleToggle = useCallback(async (name: string, enabled: boolean) => {
    try {
      const updated = await updateProvider(name, { enabled })
      setProviders(prev => prev.map(p => (p.name === name ? updated : p)))
    }
    catch (error) {
      console.error('Failed to toggle provider:', error)
    }
  }, [])

  const handleSetDefault = useCallback(async (name: string) => {
    try {
      await setDefaultProvider(name)
      setDefaultProviderState(name)
      toast.success(t('settings.provider.toast.setDefaultSuccess'))
    }
    catch (error) {
      console.error('Failed to set default provider:', error)
      toast.error(t('settings.provider.toast.setDefaultError'))
    }
  }, [t])

  const handleAddProvider = useCallback(async (data: AIProvider) => {
    try {
      const created = await addProvider(data)
      setProviders(prev => [...prev, created])
      setDefaultProviderState(created.name)
      await setDefaultProvider(created.name)
      toast.success(t('settings.provider.toast.addSuccess'))
    }
    catch (error) {
      console.error('Failed to add provider:', error)
      toast.error(t('settings.provider.toast.addError', { message: (error as Error).message }))
    }
  }, [t])

  const handleUpdateProvider = useCallback(async (name: string, updates: Partial<AIProvider>) => {
    try {
      const updated = await updateProvider(name, updates)
      setProviders(prev => prev.map(p => (p.name === name ? updated : p)))
    }
    catch (error) {
      console.error('Failed to update provider:', error)
    }
  }, [])

  const handleDeleteProvider = useCallback(async (name: string) => {
    try {
      await removeProvider(name)
      const remaining = providers.filter(p => p.name !== name)
      setProviders(remaining)
      if (defaultProviderState === name && remaining.length > 0) {
        setDefaultProviderState(remaining[0].name)
        await setDefaultProvider(remaining[0].name)
      }
      toast.success(t('settings.provider.toast.deleteSuccess'))
    }
    catch (error) {
      console.error('Failed to delete provider:', error)
      toast.error(t('settings.provider.toast.deleteError', { message: (error as Error).message }))
    }
  }, [providers, defaultProviderState, t])

  const sortedProviders = [...providers].sort((a, b) => {
    if (a.enabled !== b.enabled)
      return a.enabled ? -1 : 1
    if (a.name === defaultProviderState)
      return -1
    if (b.name === defaultProviderState)
      return 1
    return 0
  })

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('settings.provider.title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('settings.provider.description')}</p>
        </div>
        <Button size="sm" onClick={openAddDialog}>
          <Plus className="mr-1.5" size={16} />
          {t('settings.provider.addButton')}
        </Button>
      </div>

      {providers.length === 0
        ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <p className="text-muted-foreground">{t('settings.provider.noProviders')}</p>
              <Button onClick={openAddDialog}>
                <Plus className="mr-1.5" size={16} />
                {t('settings.provider.addButton')}
              </Button>
            </div>
          )
        : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {sortedProviders.map(provider => {
                const displayModels = provider.models.slice(0, 3)
                const overflow = provider.models.length - 3

                return (
                  <div
                    key={provider.name}
                    className="flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm"
                  >
                    {/* Row 1: avatar, name, badge, star, switch */}
                    <div className="flex items-center justify-between px-4 pt-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{provider.avatar}</span>
                        <span className="font-semibold leading-none">{provider.name}</span>
                        {defaultProviderState === provider.name && (
                          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                            {t('settings.provider.defaultBadge')}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {defaultProviderState !== provider.name && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => handleSetDefault(provider.name)}
                            title={t('settings.provider.setDefaultTitle')}
                          >
                            <Star size={14} />
                          </Button>
                        )}
                        <Switch
                          checked={provider.enabled}
                          onCheckedChange={checked => handleToggle(provider.name, checked)}
                        />
                      </div>
                    </div>

                    {/* Row 2: baseUrl hostname preview */}
                    <p className="px-4 pt-1 text-xs text-muted-foreground">
                      {getHostname(provider.baseUrl)}
                    </p>

                    {/* Row 3: model badges */}
                    <div className="flex flex-wrap items-center gap-1 px-4 pt-2">
                      {provider.models.length === 0
                        ? (
                            <span className="text-xs text-muted-foreground">
                              {t('settings.provider.noModels')}
                            </span>
                          )
                        : (
                            <>
                              {displayModels.map(m => (
                                <Badge key={m} variant="outline" className="text-[10px] font-mono">
                                  {m}
                                </Badge>
                              ))}
                              {overflow > 0 && (
                                <Badge variant="secondary" className="text-[10px]">
                                  +
                                  {overflow}
                                </Badge>
                              )}
                            </>
                          )}
                    </div>

                    {/* Row 4: edit button */}
                    <div className="flex justify-end px-4 pb-4 pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(provider)}
                      >
                        <Pencil size={12} className="mr-1" />
                        编辑
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

      <ProviderFormDialog
        mode={dialogMode}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialData={editingProvider}
        onAdd={handleAddProvider}
        onUpdate={handleUpdateProvider}
        onDelete={handleDeleteProvider}
      />
    </div>
  )
}
