// 厂商预设配置
export interface VendorPreset {
  id: string
  name: string
  avatar: string
  baseUrl: string
  apiType: ProviderType
  models: string[]
}

// Provider 类型定义，用于选择 API 形式
export type ProviderType
  = | 'openai'
    | 'anthropic'
    | 'gemini'
    | 'ollama'
    | 'zhipu'
    | 'deepseek'
    | 'moonshot'
    | 'qwen'

// 厂商预设配置
export const VENDOR_PRESETS: VendorPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    avatar: '🟢',
    baseUrl: 'https://api.openai.com/v1',
    apiType: 'openai',
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
    apiType: 'anthropic',
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
    apiType: 'gemini',
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
    apiType: 'deepseek',
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
    apiType: 'qwen',
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
    apiType: 'moonshot',
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
    apiType: 'zhipu',
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
    apiType: 'ollama',
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

// 所有模型列表
export const ALL_MODELS: string[] = VENDOR_PRESETS.flatMap(v => v.models)

// 根据 ProviderType 获取对应的 API 类型
export function getApiTypeForProvider(providerId: string): ProviderType {
  const preset = VENDOR_PRESETS.find(v => v.id === providerId)
  return preset?.apiType || 'openai'
}

// 根据 API 类型获取厂商预设
export function getVendorPresetByApiType(apiType: ProviderType): VendorPreset | undefined {
  return VENDOR_PRESETS.find(v => v.apiType === apiType)
}

// 兼容旧的模型列表导出（如果有其他地方在使用）
export const PROVIDER_MODELS: Record<ProviderType, string[]> = {
  openai: VENDOR_PRESETS.find(v => v.id === 'openai')?.models || [],
  anthropic: VENDOR_PRESETS.find(v => v.id === 'anthropic')?.models || [],
  gemini: VENDOR_PRESETS.find(v => v.id === 'gemini')?.models || [],
  ollama: VENDOR_PRESETS.find(v => v.id === 'ollama')?.models || [],
  zhipu: VENDOR_PRESETS.find(v => v.id === 'zhipu')?.models || [],
  deepseek: VENDOR_PRESETS.find(v => v.id === 'deepseek')?.models || [],
  moonshot: VENDOR_PRESETS.find(v => v.id === 'moonshot')?.models || [],
  qwen: VENDOR_PRESETS.find(v => v.id === 'qwen')?.models || [],
}

/**
 * 根据模型名称推断 Provider 类型
 * 用于自动识别模型属于哪个供应商
 */
export function inferProvider(model: string): ProviderType | null {
  // 从所有厂商预设中查找模型
  for (const preset of VENDOR_PRESETS) {
    if (preset.models.includes(model)) {
      return preset.apiType
    }
  }

  // Fallback: 根据模型名称前缀推断
  const lower = model.toLowerCase()
  if (lower.startsWith('gpt-') || lower.startsWith('o1') || lower.startsWith('o3') || lower.startsWith('o4'))
    return 'openai'
  if (lower.startsWith('claude-'))
    return 'anthropic'
  if (lower.startsWith('gemini-'))
    return 'gemini'
  if (lower.startsWith('glm-'))
    return 'zhipu'
  if (lower.startsWith('deepseek'))
    return 'deepseek'
  if (lower.startsWith('moonshot'))
    return 'moonshot'
  if (lower.startsWith('qwen'))
    return 'qwen'

  return null
}

// 导出默认配置
export default {
  VENDOR_PRESETS,
  ALL_MODELS,
  PROVIDER_MODELS,
}
