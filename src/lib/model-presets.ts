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
