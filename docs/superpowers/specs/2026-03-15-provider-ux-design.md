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
  id: string       // machine identifier, e.g. 'openai'
  name: string     // display name, e.g. 'OpenAI'
  avatar: string   // emoji, e.g. '🤖'
  baseUrl: string  // default API base URL
  models: string[] // ordered list of current model IDs
}
```

### Vendor Presets

All model IDs are sourced from official provider API documentation (verified 2026-03).

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
    'claude-opus-4-5',
    'claude-opus-4-1',
    'claude-opus-4',
    'claude-sonnet-4',
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

Cards become compact, read-only status displays. All editing moves to `ProviderFormDialog`.

```
┌─────────────────────────────────────────┐
│  🟢  OpenAI          [默认]    ●──  ○   │
│      api.openai.com/v1                  │
│      gpt-4.1  gpt-4o  o3  +6           │
│                              [编辑]     │
└─────────────────────────────────────────┘
```

**Card elements:**
- Row 1: avatar (emoji), provider name, Default badge (if applicable), enabled Switch
- Row 2: baseUrl preview — truncated to hostname + path prefix, `text-xs text-muted-foreground`
- Row 3: first 3 model names as small badges + `+N` count badge if more exist; if no models: `text-muted-foreground` placeholder
- Row 4: "编辑" Button (`variant="outline" size="sm"`) aligned to the right

**Removed from cards:** Base URL input, API Key input, TagInput, delete button.

The Switch remains on the card (high-frequency action). Delete moves to the edit dialog.

### Empty state

When `providers.length === 0`, show a centred empty state with a "新增供应商" button — same as today but more prominent.

---

## ProviderFormDialog

A single dialog component used for both add and edit. Receives `mode: 'add' | 'edit'` and an optional existing `AIProvider`.

### Dialog header
- Add mode: title "添加供应商"
- Edit mode: title "编辑供应商"

### Vendor preset chips (top section)

A labelled section "快速选择厂商" showing 8 chip buttons, one per vendor, in a wrapping flex row:

```
快速选择厂商
[🟢 OpenAI] [🔶 Anthropic] [🔵 Gemini] [🐋 DeepSeek]
[☁️ Qwen]  [🌙 Moonshot]  [🧠 智谱]   [🦙 Ollama]
```

Clicking a chip immediately overwrites all four fields: name, avatar, baseUrl, models. No confirmation. Fields remain editable after the fill.

Chips use `variant="outline" size="sm"`. The active/selected chip (matching current `name` value) gets `variant="secondary"` to indicate the current selection.

### Form fields (vertical layout, no grid)

Each field: `<Label>` above `<Input>` or `<TagInput>`, full width, `space-y-4` between fields.

```
名称 *
[OpenAI                                    ]

头像
[🟢                                        ]

Base URL *
[https://api.openai.com/v1                 ]

API Key
[••••••••••••••••••••••••••••••••••         ]

模型列表
[gpt-4.1 ✕][gpt-4o ✕][o3 ✕]  输入添加…
```

- Name and Base URL are required (save button disabled if either is empty)
- API Key uses `type="password"`
- Models field is `TagInput` with `ALL_MODELS` suggestions

### Dialog footer

```
Edit mode:   [删除供应商]        [取消]  [保存]
Add mode:                        [取消]  [添加]
```

- Delete button: `variant="destructive"`, left-aligned; triggers inline confirm (Popover or confirm text swap) before calling `removeProvider`
- Cancel: closes dialog, no changes
- Save/Add: calls `updateProvider` or `addProvider`

---

## File Changes

| File | Action | Change |
|------|--------|--------|
| `src/lib/model-presets.ts` | Create | `VendorPreset` interface, `VENDOR_PRESETS` array, `ALL_MODELS` export |
| `src/components/ui/tag-input.tsx` | Modify | Remove inline `COMMON_MODELS`; import `ALL_MODELS` from `model-presets.ts` |
| `src/routes/setting/provider.tsx` | Rewrite | Compact cards + extract `ProviderFormDialog` component |

No new dependencies. No schema or store changes. No i18n additions (new text hardcoded; existing keys reused where possible).

---

## Non-goals

- Auto-detecting provider from API key format
- Fetching live model lists from provider APIs
- OpenRouter or other aggregator presets
- Model capability metadata (context window, pricing)
- Drag-to-reorder providers
