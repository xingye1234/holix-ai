import type { createDeepAgent } from 'deepagents'
import type { SessionModelConfig } from './session-state'
import { initChatModel } from 'langchain/chat_models/universal'

type DeepAgentParams = NonNullable<Parameters<typeof createDeepAgent>[0]>
export type SessionDeepAgentModel = Exclude<DeepAgentParams['model'], string | undefined>

export async function buildSessionModel(modelConfig: SessionModelConfig) {
  const { provider, model, apiKey, baseURL } = modelConfig
  const modelProvider = normalizeModelProvider(provider)
  const modelIdentifier = `${modelProvider}:${model}`

  if (modelProvider === 'anthropic') {
    return await initChatModel(modelIdentifier, {
      apiKey,
      anthropicApiUrl: baseURL,
      streaming: true,
    })
  }

  if (modelProvider === 'google-genai') {
    return await initChatModel(modelIdentifier, {
      apiKey,
      baseUrl: baseURL,
      streaming: true,
    })
  }

  if (modelProvider === 'ollama') {
    return await initChatModel(modelIdentifier, {
      baseUrl: baseURL,
      streaming: true,
    })
  }

  return await initChatModel(modelIdentifier, {
    apiKey,
    configuration: baseURL ? { baseURL } : undefined,
    streaming: true,
  })
}

export function normalizeModelProvider(provider: string) {
  const normalizedProvider = provider.toLowerCase()

  if (normalizedProvider === 'gemini' || normalizedProvider === 'google-genai') {
    return 'google-genai'
  }

  if (normalizedProvider === 'anthropic' || normalizedProvider === 'ollama') {
    return normalizedProvider
  }

  return 'openai'
}

export function asDeepAgentModel(
  model: Awaited<ReturnType<typeof buildSessionModel>>,
): SessionDeepAgentModel {
  return model as unknown as SessionDeepAgentModel
}
