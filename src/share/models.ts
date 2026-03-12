// OpenAI - 聊天模型
export const OPENAI_CHAT_MODELS = [
  'gpt-5-2',
  'gpt-5-2-pro',
  'gpt-5-2-chat',
  'gpt-5-1',
  'gpt-5-1-codex',
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-5-pro',
  'gpt-5-codex',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4',
  'gpt-4-32k',
  'gpt-4-32k-0314',
  'gpt-4o-mini-2024',
  'gpt-4o-realtime-preview',
  'gpt-3.5-turbo',
  'gpt-3.5-turbo-16k',
  'gpt-3.5-turbo-0613',
] as const

export type OpenAIChatModel = (typeof OPENAI_CHAT_MODELS)[number]

// OpenAI - 图像模型
export const OPENAI_IMAGE_MODELS = [
  'gpt-image-1',
  'gpt-image-1-mini',
  'dall-e-3',
  'dall-e-2',
  'stable-diffusion-v1',
  'stable-diffusion-v2',
] as const

export type OpenAIImageModel = (typeof OPENAI_IMAGE_MODELS)[number]

// OpenAI - 视频/生成模型
export const OPENAI_VIDEO_MODELS = [
  'sora-2',
  'sora-2-pro',
  'runway-gen2',
] as const

export type OpenAIVideoModel = (typeof OPENAI_VIDEO_MODELS)[number]

// Anthropic - Claude 家族
export const ANTHROPIC_MODELS = [
  'claude-2',
  'claude-2-100k',
  'claude-instant-1',
  'claude-3',
  'claude-3-100k',
] as const
export type AnthropicModel = (typeof ANTHROPIC_MODELS)[number]

// Google - Gemini
export const GEMINI_MODELS = [
  'gemini-1',
  'gemini-1.5',
  'gemini-1-5-pro',
  'gemini-pro',
  'gemini-1.5-mini',
] as const
export type GeminiModel = (typeof GEMINI_MODELS)[number]

// Ollama / 本地模型
export const OLLAMA_MODELS = [
  'llama2',
  'llama2-chat',
  'llama3',
  'vicuna-13b',
  'mistral',
  'mistral-instant',
] as const
export type OllamaModel = (typeof OLLAMA_MODELS)[number]

// 智谱AI - GLM 系列
export const ZHIPU_MODELS = [
  'glm-4-plus',
  'glm-4-air',
  'glm-4-flash',
  'glm-4',
  'glm-3-turbo',
] as const
export type ZhipuModel = (typeof ZHIPU_MODELS)[number]

// DeepSeek
export const DEEPSEEK_MODELS = [
  'deepseek-chat',
  'deepseek-reasoner',
] as const
export type DeepSeekModel = (typeof DEEPSEEK_MODELS)[number]

// Moonshot
export const MOONSHOT_MODELS = [
  'moonshot-v1-8k',
  'moonshot-v1-32k',
  'moonshot-v1-128k',
] as const
export type MoonshotModel = (typeof MOONSHOT_MODELS)[number]

// 阿里云百炼 - Qwen
export const QWEN_MODELS = [
  'qwen-max',
  'qwen-plus',
  'qwen-turbo',
] as const
export type QwenModel = (typeof QWEN_MODELS)[number]

// 汇总所有已知模型名称（便于全局类型或下拉选择）
export type KnownModelName
  = | OpenAIChatModel
    | OpenAIImageModel
    | OpenAIVideoModel
    | AnthropicModel
    | GeminiModel
    | OllamaModel
    | ZhipuModel
    | DeepSeekModel
    | MoonshotModel
    | QwenModel

export const PROVIDER_MODELS = {
  openai: {
    chat: OPENAI_CHAT_MODELS,
    image: OPENAI_IMAGE_MODELS,
    video: OPENAI_VIDEO_MODELS,
  },
  anthropic: ANTHROPIC_MODELS,
  gemini: GEMINI_MODELS,
  ollama: OLLAMA_MODELS,
  zhipu: ZHIPU_MODELS,
  deepseek: DEEPSEEK_MODELS,
  moonshot: MOONSHOT_MODELS,
  qwen: QWEN_MODELS,
} as const

export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'zhipu' | 'deepseek' | 'moonshot' | 'qwen'

export function inferProvider(model: string): ProviderType | null {
  if (
    [
      ...OPENAI_CHAT_MODELS,
      ...OPENAI_IMAGE_MODELS,
      ...OPENAI_VIDEO_MODELS,
    ].includes(model as OpenAIChatModel)
  ) {
    return 'openai'
  }

  if (ANTHROPIC_MODELS.includes(model as AnthropicModel)) {
    return 'anthropic'
  }

  if (GEMINI_MODELS.includes(model as GeminiModel)) {
    return 'gemini'
  }

  if (OLLAMA_MODELS.includes(model as OllamaModel)) {
    return 'ollama'
  }

  if (ZHIPU_MODELS.includes(model as ZhipuModel)) {
    return 'zhipu'
  }

  if (DEEPSEEK_MODELS.includes(model as DeepSeekModel)) {
    return 'deepseek'
  }

  if (MOONSHOT_MODELS.includes(model as MoonshotModel)) {
    return 'moonshot'
  }

  if (QWEN_MODELS.includes(model as QwenModel)) {
    return 'qwen'
  }

  // Fallback: 根据模型名称前缀推断
  const lower = model.toLowerCase()
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

export default {
  OPENAI_CHAT_MODELS,
  OPENAI_IMAGE_MODELS,
  OPENAI_VIDEO_MODELS,
  ANTHROPIC_MODELS,
  GEMINI_MODELS,
  OLLAMA_MODELS,
  ZHIPU_MODELS,
  DEEPSEEK_MODELS,
  MOONSHOT_MODELS,
  QWEN_MODELS,
  PROVIDER_MODELS,
}
