import type { ProviderType, VendorPreset } from '@/share/models'
import type { AIProvider } from '@/types/provider'
import { createFileRoute } from '@tanstack/react-router'
import { ImagePlus, Pencil, Plus, RotateCcw, Star, Upload } from 'lucide-react'
import { useCallback, useEffect, useId, useState, useRef } from 'react'
import { toast } from 'sonner'
import { ProviderAvatar, PROVIDER_AVATAR_PRESETS } from '@/components/provider-avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { TagInput } from '@/components/ui/tag-input'
import { useI18n } from '@/i18n/provider'
import {
  addProvider,
  getDefaultProvider,
  getProviders,
  removeProvider,
  setDefaultProvider,
  toggleProvider,
  updateProvider,
} from '@/lib/provider'
import { ALL_MODELS, VENDOR_PRESETS } from '@/share/models'

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

async function readFileAsDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('read-failed'))
    reader.readAsDataURL(file)
  })
}

async function loadImage(src: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('image-load-failed'))
    image.src = src
  })
}

async function convertImageFileToAvatar(file: File) {
  const rawDataUrl = await readFileAsDataUrl(file)
  const image = await loadImage(rawDataUrl)
  const maxSize = 160
  const scale = Math.min(maxSize / image.width, maxSize / image.height, 1)
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')

  if (!context)
    throw new Error('canvas-unavailable')

  context.drawImage(image, 0, 0, width, height)

  return canvas.toDataURL('image/webp', 0.85)
}

// ─── ProviderFormDialog ────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '',
  avatar: '🤖',
  baseUrl: '',
  apiKey: '',
  apiType: 'openai' as ProviderType,
  models: [] as string[],
  temperature: '',
  maxTokens: '',
}

function toOptionalNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed)
    return undefined

  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
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
  const fileInputId = useId()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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
        apiType: initialData.apiType || 'openai',
        models: initialData.models,
        temperature: initialData.temperature?.toString() ?? '',
        maxTokens: initialData.maxTokens?.toString() ?? '',
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
      apiType: vendor.apiType,
      models: vendor.models,
    }))
  }

  function handleFieldChange(field: 'name' | 'avatar' | 'baseUrl' | 'temperature' | 'maxTokens', value: string) {
    setSelectedVendorId(null)
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file)
      return

    try {
      if (!file.type.startsWith('image/')) {
        toast.error(t('settings.provider.toast.invalidAvatarFile'))
        return
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error(t('settings.provider.toast.avatarFileTooLarge'))
        return
      }

      const avatar = await convertImageFileToAvatar(file)
      handleFieldChange('avatar', avatar)
      toast.success(t('settings.provider.toast.avatarUploadSuccess'))
    }
    catch (error) {
      console.error('Failed to process avatar file:', error)
      toast.error(t('settings.provider.toast.avatarUploadError'))
    }
    finally {
      event.target.value = ''
    }
  }

  function handleSave() {
    const temperature = toOptionalNumber(form.temperature)
    const maxTokens = toOptionalNumber(form.maxTokens)

    if (mode === 'add') {
      onAdd?.({
        name: form.name,
        avatar: form.avatar,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey,
        apiType: form.apiType,
        models: form.models,
        temperature,
        maxTokens,
        enabled: false,
      })
    }
    else {
      if (!initialData)
        return
      onUpdate?.(initialData.name, {
        avatar: form.avatar,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey,
        apiType: form.apiType,
        models: form.models,
        temperature,
        maxTokens,
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

        <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto">
          {/* Vendor preset chips */}
          <div className="space-y-2">
            <Label>{t('settings.provider.vendorPresetLabel')}</Label>
            <div className="flex flex-wrap gap-2">
              {VENDOR_PRESETS.filter(vendor => vendor.id !== 'ollama').map(vendor => (
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
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <ProviderAvatar
                  avatar={form.avatar}
                  name={form.name}
                  className="size-16 border-2"
                  fallbackClassName="text-lg"
                  textClassName="text-2xl"
                />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="mr-2 size-4" />
                      {t('settings.provider.addDialog.uploadAvatarButton')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleFieldChange('avatar', EMPTY_FORM.avatar)}
                    >
                      <RotateCcw className="mr-2 size-4" />
                      {t('settings.provider.addDialog.resetAvatarButton')}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('settings.provider.addDialog.avatarHelp')}
                  </p>
                </div>
              </div>

              <input
                id={fileInputId}
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />

              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ImagePlus className="size-4" />
                  {t('settings.provider.addDialog.avatarPresetLabel')}
                </div>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                  {PROVIDER_AVATAR_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      className="flex flex-col items-center gap-2 rounded-lg border p-2 transition-colors hover:bg-accent hover:text-accent-foreground"
                      onClick={() => handleFieldChange('avatar', preset.avatar)}
                    >
                      <ProviderAvatar
                        avatar={preset.avatar}
                        name={preset.label}
                        className="size-12 border"
                        textClassName="text-base"
                      />
                      <span className="text-[11px] text-muted-foreground">{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Label htmlFor="dialog-avatar">{t('settings.provider.addDialog.avatarInputLabel')}</Label>
                <Input
                  id="dialog-avatar"
                  value={form.avatar}
                  onChange={e => handleFieldChange('avatar', e.target.value)}
                  placeholder={t('settings.provider.addDialog.avatarPlaceholder')}
                />
              </div>
            </div>
          </div>

          {/* Base URL */}
          <div className="space-y-2">
            <Label htmlFor="dialog-baseUrl">
              {t('settings.provider.baseUrlLabel')}
              {' '}
              *
            </Label>
            <Input
              id="dialog-baseUrl"
              type="url"
              value={form.baseUrl}
              onChange={e => handleFieldChange('baseUrl', e.target.value)}
              placeholder={t('settings.provider.baseUrlPlaceholder')}
            />
          </div>

          {/* API Type */}
          <div className="space-y-2">
            <Label htmlFor="dialog-apiType">{t('settings.provider.apiTypeLabel')}</Label>
            <select
              id="dialog-apiType"
              value={form.apiType}
              onChange={e => setForm(prev => ({ ...prev, apiType: e.target.value as ProviderType }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="openai">{t('settings.provider.apiTypeNames.openai')}</option>
              <option value="anthropic">{t('settings.provider.apiTypeNames.anthropic')}</option>
              <option value="gemini">{t('settings.provider.apiTypeNames.gemini')}</option>
              <option value="deepseek">{t('settings.provider.apiTypeNames.deepseek')}</option>
              <option value="qwen">{t('settings.provider.apiTypeNames.qwen')}</option>
              <option value="moonshot">{t('settings.provider.apiTypeNames.moonshot')}</option>
              <option value="zhipu">{t('settings.provider.apiTypeNames.zhipu')}</option>
            </select>
            <p className="text-xs text-muted-foreground">
              {t('settings.provider.apiTypeDescription')}
            </p>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="dialog-apiKey">{t('settings.provider.apiKeyLabel')}</Label>
            <Input
              id="dialog-apiKey"
              type="password"
              value={form.apiKey}
              onChange={e => setForm(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder={t('settings.provider.apiKeyPlaceholder')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dialog-temperature">{t('settings.provider.temperatureLabel')}</Label>
              <Input
                id="dialog-temperature"
                type="number"
                min={0}
                max={2}
                step="0.1"
                value={form.temperature}
                onChange={e => handleFieldChange('temperature', e.target.value)}
                placeholder={t('settings.provider.temperaturePlaceholder')}
              />
              <p className="text-xs text-muted-foreground">
                {t('settings.provider.temperatureDescription')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dialog-maxTokens">{t('settings.provider.maxTokensLabel')}</Label>
              <Input
                id="dialog-maxTokens"
                type="number"
                min={1}
                step="1"
                value={form.maxTokens}
                onChange={e => handleFieldChange('maxTokens', e.target.value)}
                placeholder={t('settings.provider.maxTokensPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">
                {t('settings.provider.maxTokensDescription')}
              </p>
            </div>
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
                        if (!initialData)
                          return
                        onDelete?.(initialData.name)
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
      const updated = await toggleProvider(name, enabled)
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
      await setDefaultProvider(created.name)
      setProviders(prev => [...prev, created])
      setDefaultProviderState(created.name)
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
      let remaining: AIProvider[] = []
      setProviders((prev) => {
        remaining = prev.filter(p => p.name !== name)
        return remaining
      })
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
  }, [defaultProviderState, t])

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
              {sortedProviders.map((provider) => {
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
                        <ProviderAvatar
                          avatar={provider.avatar}
                          name={provider.name}
                          className="size-9"
                          textClassName="text-lg"
                        />
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

                    <div className="flex flex-wrap items-center gap-2 px-4 pt-2 text-[11px] text-muted-foreground">
                      <span>
                        {t('settings.provider.defaultTemperatureSummary', {
                          value: provider.temperature ?? t('settings.provider.notSet'),
                        })}
                      </span>
                      <span>
                        {t('settings.provider.defaultMaxTokensSummary', {
                          value: provider.maxTokens ?? t('settings.provider.notSet'),
                        })}
                      </span>
                    </div>

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
                        {t('common.edit')}
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
