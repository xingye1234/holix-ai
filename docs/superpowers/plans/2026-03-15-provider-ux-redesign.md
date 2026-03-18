# Provider Management UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inline-edit provider cards with compact read-only cards and a shared add/edit dialog with one-click vendor preset chips.

**Architecture:** Three layered changes: (1) a new `model-presets.ts` data module replaces the scattered `COMMON_MODELS` list; (2) `tag-input.tsx` imports `ALL_MODELS` from that module; (3) `provider.tsx` is rewritten with compact cards and a shared `ProviderFormDialog` component defined in the same file.

**Tech Stack:** React, TypeScript, TanStack Router, Zustand, Vitest + @testing-library/react, shadcn UI components (Button, Dialog, Input, Label, Popover, Switch, Badge), lucide-react, sonner (toast)

**Spec:** `docs/superpowers/specs/2026-03-15-provider-ux-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/model-presets.ts` | Create | `VendorPreset` interface, `VENDOR_PRESETS` array (8 vendors), `ALL_MODELS` flat export |
| `src/lib/__tests__/model-presets.test.ts` | Create | Smoke tests: preset count, shape, spot-check model IDs |
| `src/components/ui/tag-input.tsx` | Modify | Remove inline `COMMON_MODELS`; import `ALL_MODELS` as default suggestions |
| `src/routes/setting/provider.tsx` | Rewrite | Compact read-only cards + `ProviderFormDialog` (add/edit/delete) |
| `src/i18n/locales/zh-CN.ts` | Modify | Add `vendorPresetLabel`, `editDialog`, `noModels` under `settings.provider` |
| `src/i18n/locales/en-US.ts` | Modify | Same new keys in English |

---

## Chunk 1: Data Layer

### Task 1: Create `src/lib/model-presets.ts` with tests

**Files:**
- Create: `src/lib/__tests__/model-presets.test.ts`
- Create: `src/lib/model-presets.ts`

- [ ] **Step 1: Write the failing test**

  Create `src/lib/__tests__/model-presets.test.ts`:

  ```ts
  import { describe, expect, it } from 'vitest'
  import { ALL_MODELS, VENDOR_PRESETS } from '../model-presets'

  describe('VENDOR_PRESETS', () => {
    it('has exactly 8 vendors', () => {
      expect(VENDOR_PRESETS).toHaveLength(8)
    })

    it('each vendor has required fields', () => {
      for (const v of VENDOR_PRESETS) {
        expect(typeof v.id).toBe('string')
        expect(typeof v.name).toBe('string')
        expect(typeof v.avatar).toBe('string')
        expect(typeof v.baseUrl).toBe('string')
        expect(Array.isArray(v.models)).toBe(true)
        expect(v.models.length).toBeGreaterThan(0)
      }
    })

    it('has unique vendor IDs', () => {
      const ids = VENDOR_PRESETS.map(v => v.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  })

  describe('ALL_MODELS', () => {
    it('is a flat string array', () => {
      expect(Array.isArray(ALL_MODELS)).toBe(true)
      expect(ALL_MODELS.every(m => typeof m === 'string')).toBe(true)
    })

    it('contains spot-checked model IDs', () => {
      expect(ALL_MODELS).toContain('gpt-4.1')
      expect(ALL_MODELS).toContain('claude-sonnet-4-6')
      expect(ALL_MODELS).toContain('gemini-2.5-pro')
      expect(ALL_MODELS).toContain('deepseek-chat')
    })

    it('length equals sum of all vendor model counts', () => {
      const total = VENDOR_PRESETS.reduce((sum, v) => sum + v.models.length, 0)
      expect(ALL_MODELS).toHaveLength(total)
    })
  })
  ```

- [ ] **Step 2: Run test to confirm it fails**

  ```bash
  pnpm vitest run --project ui src/lib/__tests__/model-presets.test.ts
  ```

  Expected: FAIL — `Cannot find module '../model-presets'`

- [ ] **Step 3: Implement `model-presets.ts`**

  Create `src/lib/model-presets.ts`:

  ```ts
  export interface VendorPreset {
    id: string
    name: string
    avatar: string
    baseUrl: string
    models: string[]
  }

  export const VENDOR_PRESETS: VendorPreset[] = [
    {
      id: 'openai',
      name: 'OpenAI',
      avatar: '🟢',
      baseUrl: 'https://api.openai.com/v1',
      models: [
        'gpt-4.1',
        'gpt-4.1-mini',
        'gpt-4.1-nano',
        'gpt-4o',
        'gpt-4o-mini',
        'o3',
        'o4-mini',
        'o1',
        'o3-mini',
      ],
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      avatar: '🔶',
      baseUrl: 'https://api.anthropic.com',
      models: [
        'claude-opus-4-6',
        'claude-sonnet-4-6',
        'claude-haiku-4-5-20251001',
        'claude-opus-4-5',
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
      ],
    },
    {
      id: 'gemini',
      name: 'Gemini',
      avatar: '🔵',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      models: [
        'gemini-2.5-pro',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        'gemini-1.5-pro',
        'gemini-1.5-flash',
      ],
    },
    {
      id: 'deepseek',
      name: 'DeepSeek',
      avatar: '🐋',
      baseUrl: 'https://api.deepseek.com/v1',
      models: [
        'deepseek-chat',
        'deepseek-reasoner',
      ],
    },
    {
      id: 'qwen',
      name: 'Qwen',
      avatar: '☁️',
      baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      models: [
        'qwen-max',
        'qwen-plus',
        'qwen-turbo',
        'qwen-long',
        'qwq-plus',
        'qwen3-235b-a22b',
        'qwen3-32b',
      ],
    },
    {
      id: 'moonshot',
      name: 'Moonshot',
      avatar: '🌙',
      baseUrl: 'https://api.moonshot.cn/v1',
      models: [
        'moonshot-v1-8k',
        'moonshot-v1-32k',
        'moonshot-v1-128k',
      ],
    },
    {
      id: 'zhipu',
      name: '智谱',
      avatar: '🧠',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      models: [
        'glm-4.7',
        'glm-4.7-flash',
        'glm-4-plus',
        'glm-4',
        'glm-4-air',
        'glm-4-flash',
      ],
    },
    {
      id: 'ollama',
      name: 'Ollama',
      avatar: '🦙',
      baseUrl: 'http://localhost:11434/v1',
      models: [
        'llama3.3',
        'llama3.2',
        'qwen2.5',
        'deepseek-r1',
        'mistral',
        'gemma3',
        'phi4',
      ],
    },
  ]

  export const ALL_MODELS: string[] = VENDOR_PRESETS.flatMap(v => v.models)
  ```

- [ ] **Step 4: Run test to confirm it passes**

  ```bash
  pnpm vitest run --project ui src/lib/__tests__/model-presets.test.ts
  ```

  Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/model-presets.ts src/lib/__tests__/model-presets.test.ts
  git commit -m "feat: add model-presets data module with vendor presets and ALL_MODELS"
  ```

---

### Task 2: Update `tag-input.tsx` to use `ALL_MODELS`

**Files:**
- Modify: `src/components/ui/tag-input.tsx`

No new tests — this is a one-line default prop change; the existing `TagInput` behaviour is unchanged.

- [ ] **Step 1: Replace `COMMON_MODELS` with `ALL_MODELS` import**

  In `src/components/ui/tag-input.tsx`:

  Remove lines 16–72 (the entire `// ─── 常见模型候选表 ─` block containing the `COMMON_MODELS` export).

  Add this import at the top of the file (after existing imports):

  ```ts
  import { ALL_MODELS } from '@/lib/model-presets'
  ```

  Change the default value for `suggestions` in the component signature (line ~92 before the edit):

  ```ts
  // BEFORE
  suggestions = COMMON_MODELS,

  // AFTER
  suggestions = ALL_MODELS,
  ```

  The full updated signature block should look like:

  ```ts
  export function TagInput({
    value,
    onChange,
    suggestions = ALL_MODELS,
    placeholder = '输入模型名称，按 Enter 添加…',
    className,
    disabled = false,
  }: TagInputProps) {
  ```

- [ ] **Step 2: Run the full test suite to confirm nothing broke**

  ```bash
  pnpm vitest run --project ui
  ```

  Expected: All tests pass (the 5 model-presets tests + existing tests). No failures.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/ui/tag-input.tsx
  git commit -m "refactor: replace COMMON_MODELS in TagInput with ALL_MODELS from model-presets"
  ```

---

## Chunk 2: UI Layer

### Task 3: Add new i18n keys

**Files:**
- Modify: `src/i18n/locales/zh-CN.ts`
- Modify: `src/i18n/locales/en-US.ts`

No tests — i18n files are static data consumed by the UI; coverage comes from the manual verification in Task 5.

- [ ] **Step 1: Add keys to `zh-CN.ts`**

  In `src/i18n/locales/zh-CN.ts`, inside the `settings.provider` object, add three new entries after the `addDialog` block (before the closing `},` of `provider`):

  ```ts
  vendorPresetLabel: '快速选择厂商',
  editDialog: {
    title: '编辑供应商',
    saveButton: '保存',
  },
  noModels: '暂无模型',
  ```

  The updated `provider` object should end like:

  ```ts
  provider: {
    title: 'AI 供应商配置',
    // ... existing keys unchanged ...
    addDialog: {
      title: '添加新供应商',
      nameLabel: '名称',
      namePlaceholder: 'OpenAI',
      avatarLabel: '头像',
      avatarPlaceholder: '🤖',
      modelsLabel: '模型列表',
      cancelButton: '取消',
      addButton: '添加',
    },
    vendorPresetLabel: '快速选择厂商',
    editDialog: {
      title: '编辑供应商',
      saveButton: '保存',
    },
    noModels: '暂无模型',
  },
  ```

- [ ] **Step 2: Add keys to `en-US.ts`**

  In `src/i18n/locales/en-US.ts`, add the same three entries in the same position:

  ```ts
  vendorPresetLabel: 'Quick vendor select',
  editDialog: {
    title: 'Edit Provider',
    saveButton: 'Save',
  },
  noModels: 'No models',
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/i18n/locales/zh-CN.ts src/i18n/locales/en-US.ts
  git commit -m "feat: add i18n keys for provider edit dialog and vendor preset label"
  ```

---

### Task 4: Rewrite `provider.tsx` with compact cards and `ProviderFormDialog`

**Files:**
- Rewrite: `src/routes/setting/provider.tsx`

No automated tests for this component — it requires complex store mocking. Manual verification is in Task 5.

- [ ] **Step 1: Replace the contents of `provider.tsx`**

  Replace the entire file with the following:

  ```tsx
  import type { VendorPreset } from '@/lib/model-presets'
  import type { AIProvider } from '@/types/provider'
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

    const emptyForm = {
      name: '',
      avatar: '🤖',
      baseUrl: '',
      apiKey: '',
      models: [] as string[],
    }

    const [form, setForm] = useState(emptyForm)
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
        setForm(emptyForm)
      }
      setSelectedVendorId(null)
      setDeletePopoverOpen(false)
    }, [open])

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
  ```

- [ ] **Step 2: Run full test suite**

  ```bash
  pnpm vitest run --project ui
  ```

  Expected: All tests pass. No TypeScript errors in terminal output.

- [ ] **Step 3: Commit**

  ```bash
  git add src/routes/setting/provider.tsx
  git commit -m "feat: rewrite provider page with compact cards and ProviderFormDialog"
  ```

---

### Task 5: Manual end-to-end verification

- [ ] **Step 1: Start dev server**

  ```bash
  pnpm dev
  ```

- [ ] **Step 2: Verify compact cards**

  Navigate to Settings → Providers.

  Expected:
  - Cards show avatar emoji, name, Default badge (for default provider), Star button (for non-default), enabled Switch
  - Row 2: hostname of baseUrl (e.g. `api.openai.com`)
  - Row 3: first 3 models as small badges + `+N` overflow badge; or "暂无模型" if empty
  - Row 4: "编辑" button right-aligned
  - No inline Base URL / API Key / TagInput on cards

- [ ] **Step 3: Verify add flow**

  Click "新增" button. Dialog opens.

  Expected:
  - 8 vendor chip buttons visible (🟢 OpenAI … 🦙 Ollama)
  - Vertical form layout: 名称, 头像, Base URL, API Key, 模型列表
  - "添加" button disabled when Name or Base URL is empty

  Click a vendor chip (e.g. 🟢 OpenAI):

  Expected:
  - Chip becomes `variant="secondary"` (highlighted)
  - Name, avatar, Base URL, models all auto-filled
  - Other chips remain `variant="outline"`

  Manually edit the Name field:

  Expected: All chips return to `variant="outline"` (selectedVendorId cleared)

  Fill required fields, click "添加":

  Expected: Dialog closes, new card appears in grid.

- [ ] **Step 4: Verify edit flow**

  Click "编辑" on an existing card.

  Expected:
  - Dialog title shows "编辑供应商"
  - Name is shown as plain text (not an Input)
  - Other fields pre-filled from provider data
  - Vendor chip matching the current baseUrl is NOT pre-highlighted (selectedVendorId starts null)
  - "删除供应商" destructive button visible at footer left

  Click a vendor chip:

  Expected: Avatar, baseUrl, models overwritten; name unchanged (edit mode).

  Click "删除供应商":

  Expected: Popover opens with confirmation text and "确认删除" button.

  Click "确认删除":

  Expected: Provider removed from list, dialog closes, toast shown.

  Re-open edit dialog, change baseUrl, click "保存":

  Expected: Card updates to reflect new hostname.

- [ ] **Step 5: Verify TagInput autocomplete uses updated model list**

  In the add dialog, type "gpt-4.1" in the 模型列表 field:

  Expected: `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano` appear in suggestions.

  Type "claude-sonnet":

  Expected: `claude-sonnet-4-6` appears in suggestions.

- [ ] **Step 6: Verify enabled state is not clobbered by edit dialog save**

  Toggle a provider's enabled Switch to OFF on the card, then open its edit dialog and click "保存" without changing anything.

  Expected: The provider's enabled state remains OFF after saving. The `handleUpdateProvider` only sends `{ avatar, baseUrl, apiKey, models }` — `enabled` is not included in the update payload, so the Switch state is preserved independently.

- [ ] **Step 7: Run full test suite one final time**

  ```bash
  pnpm vitest run --project ui
  ```

  Expected: All tests pass.

- [ ] **Step 8: Commit any fixes found during verification**

  ```bash
  git add -p
  git commit -m "fix: address issues found during manual verification"
  ```
