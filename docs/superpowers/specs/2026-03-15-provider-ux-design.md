# Provider Management UX Redesign

**Date**: 2026-03-15
**Status**: Approved
**Scope**: Vendor model presets data layer + provider card redesign + shared add/edit dialog

---

## Overview

Three coordinated improvements to the provider settings experience:

1. **`src/lib/model-presets.ts`** — Centralised, accurate vendor preset data (replaces scattered `COMMON_MODELS`)
2. **Provider cards** — Compact read-only display; no inline editing
3. **`ProviderFormDialog`** — Shared add/edit dialog with one-click vendor preset chips

---

## Data Layer: `src/lib/model-presets.ts`

### Interface

```ts
export interface VendorPreset {
  id: string // machine identifier, e.g. 'openai'
  name: string // display name, e.g. 'OpenAI'
  avatar: string // emoji, e.g. '🤖'
  baseUrl: string // default API base URL
  models: string[] // ordered list of current model IDs
}
```

### Vendor Presets

Model IDs sourced from official provider API documentation and verified via web search in 2026-03.
Note: the OpenAI `gpt-4.1` family and `o4-mini` were released in April 2025 and confirmed available at the time of writing. Anthropic short-form IDs (`claude-opus-4-6`, `claude-sonnet-4-6`) are the official API identifiers per Anthropic's documentation; they do not use date-stamp suffixes in the short form.

#### OpenAI
```ts
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
}
```

#### Anthropic
```ts
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
}
```

#### Google Gemini
```ts
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
}
```

#### DeepSeek
```ts
{
  id: 'deepseek',
  name: 'DeepSeek',
  avatar: '🐋',
  baseUrl: 'https://api.deepseek.com/v1',
  models: [
    'deepseek-chat',
    'deepseek-reasoner',
  ],
}
```

#### Qwen（阿里云百炼）
```ts
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
}
```

#### Moonshot（Kimi）
```ts
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
}
```

#### 智谱（GLM）
```ts
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
}
```

Note: `glm-4.7` and `glm-4.7-flash` use dotted versioning per Z.ai's official API docs (released Dec 2025); older GLM-4 entries use hyphen format. Both formats are correct for their respective model generations.

#### Ollama（本地）
```ts
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
}
```

### Derived exports

```ts
// Flat list of all models — used as TagInput default suggestions
export const ALL_MODELS: string[] = VENDOR_PRESETS.flatMap(v => v.models)
```

### TagInput update

`src/components/ui/tag-input.tsx`: remove the inline `COMMON_MODELS` constant and its per-vendor comments. Import `ALL_MODELS` from `model-presets.ts` and use it as the default `suggestions` prop value. No other changes to `TagInput`.

---

## Provider Cards Redesign

### Layout

Cards become compact, read-only status displays. All editing moves to `ProviderFormDialog`. Card sort order is preserved from current implementation (enabled first, then default first within enabled).

```
┌─────────────────────────────────────────┐
│  🟢  OpenAI          [默认]  ☆  ━━━ ●  │  ← avatar + name + badge + star + toggle
│      api.openai.com/v1                  │  ← baseUrl preview (truncated)
│      gpt-4.1  gpt-4o  o3  +6           │  ← first 3 models + overflow count
│                              [编辑]     │  ← edit button
└─────────────────────────────────────────┘
```

**Card elements:**
- Row 1: avatar emoji, provider name, Default badge (conditional), Star button (set as default, hidden if already default), enabled Switch
- Row 2: baseUrl hostname preview, `text-xs text-muted-foreground`
- Row 3: first 3 model names as small badges + `+N` count badge if `models.length > 3`; if `models.length === 0`: muted placeholder text "暂无模型"
- Row 4: "编辑" Button (`variant="outline" size="sm"`) right-aligned

**Star button ("设为默认"):** ghost icon button, `Star` icon from lucide-react, `title` attribute for tooltip. Hidden when this provider is already the default. Behaviour identical to current implementation (`handleSetDefault`).

**Removed from cards:** Base URL Input, API Key Input, TagInput, delete Popover.

The Switch and Star button remain on the card (high-frequency actions).

### Empty state

When `providers.length === 0`, render the empty state with a prominent "新增供应商" button (same copy as today).

---

## ProviderFormDialog

A single dialog component used for both add and edit, defined within `provider.tsx`. Accepts:

```ts
interface ProviderFormDialogProps {
  mode: 'add' | 'edit'
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: AIProvider // required when mode === 'edit'
  onAdd?: (provider: AIProvider) => void
  onUpdate?: (name: string, updates: Partial<AIProvider>) => void
  onDelete?: (name: string) => void
}
```

**Edit mode initialisation:** form state is populated from `initialData` on dialog open. The `name` field is **read-only in edit mode** (displayed as plain text, not an Input), because `name` is the primary key used by `updateProvider(name, updates)`. Renaming a provider is not supported.

**New provider `enabled` default:** `false`, matching current behaviour.

### Vendor preset chips (top section)

A labelled section "快速选择厂商" with 8 chip buttons in a wrapping flex row:

```
快速选择厂商
[🟢 OpenAI] [🔶 Anthropic] [🔵 Gemini] [🐋 DeepSeek]
[☁️ Qwen]  [🌙 Moonshot]  [🧠 智谱]   [🦙 Ollama]
```

Active chip detection uses a `selectedVendorId: string | null` field in local form state — not name string matching. When a chip is clicked, `selectedVendorId` is set to the vendor's `id`. The chip with `id === selectedVendorId` renders with `variant="secondary"`; all others render with `variant="outline"`.

Clicking a chip immediately overwrites: `name` (add mode only — name is read-only in edit mode), `avatar`, `baseUrl`, `models`. No confirmation required.

If the user manually edits `name`, `avatar`, or `baseUrl` after selecting a chip, `selectedVendorId` is cleared (chip highlight resets).

### Form fields (vertical layout)

Each field: `<Label>` stacked above its control, full width, `space-y-4` between fields.

```
名称 *                         ← Input (add mode) or plain text (edit mode)
头像                           ← Input, maxLength=2
Base URL *                     ← Input type="url"
API Key                        ← Input type="password"
模型列表                       ← TagInput with ALL_MODELS suggestions
```

Name and Base URL are required. Save/Add button is disabled when either is empty.

### Dialog footer

```
Edit mode:   [删除供应商]          [取消] [保存]
Add mode:                          [取消] [添加]
```

- **Delete button:** `variant="destructive"`, left-aligned, edit mode only. Uses a `Popover` (consistent with existing pattern in this file) for inline confirmation. Popover contains confirmation text and a "确认删除" button that calls `onDelete`.
- **取消:** closes dialog, discards changes.
- **保存 / 添加:** calls `onUpdate` or `onAdd`; closes dialog on success.

---

## i18n

The following new keys are added to `settings.provider` in both locale files:

```ts
// zh-CN additions
provider: {
  // existing keys preserved...
  vendorPresetLabel: '快速选择厂商',
  editDialog: {
    title: '编辑供应商',
    saveButton: '保存',
  },
  noModels: '暂无模型',
}

// en-US additions
provider: {
  vendorPresetLabel: 'Quick vendor select',
  editDialog: {
    title: 'Edit Provider',
    saveButton: 'Save',
  },
  noModels: 'No models',
}
```

Reused existing keys: `addDialog.title`, `addDialog.cancelButton`, `addDialog.addButton`, `deleteButton`, `deleteConfirmation`, `confirmDelete`, `setDefaultTitle`, `modelsLabel`, `apiKeyPlaceholder`.

---

## File Changes

| File | Action | Change |
|------|--------|--------|
| `src/lib/model-presets.ts` | Create | `VendorPreset` interface, `VENDOR_PRESETS` array, `ALL_MODELS` export |
| `src/components/ui/tag-input.tsx` | Modify | Remove inline `COMMON_MODELS`; import `ALL_MODELS` from `model-presets.ts` |
| `src/routes/setting/provider.tsx` | Rewrite | Compact cards + `ProviderFormDialog` component |
| `src/i18n/locales/zh-CN.ts` | Modify | Add `vendorPresetLabel`, `editDialog`, `noModels` under `settings.provider` |
| `src/i18n/locales/en-US.ts` | Modify | Same keys in English |

No new dependencies. No schema or store changes.

---

## Non-goals

- Auto-detecting provider from API key format
- Fetching live model lists from provider APIs
- OpenRouter or other aggregator presets
- Model capability metadata (context window, pricing)
- Drag-to-reorder providers
- Renaming existing providers
