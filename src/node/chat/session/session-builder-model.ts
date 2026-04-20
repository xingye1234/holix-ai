import type { createDeepAgent } from 'deepagents'
import type { SessionModelConfig } from './session-state'
import { initChatModel } from 'langchain/chat_models/universal'
import { buildOllamaHeaders, normalizeOllamaBaseUrl } from '../../platform/ollama'

type DeepAgentParams = NonNullable<Parameters<typeof createDeepAgent>[0]>
export type SessionDeepAgentModel = Exclude<DeepAgentParams['model'], string | undefined>

export async function buildSessionModel(modelConfig: SessionModelConfig) {
  const { provider, model, apiKey, baseURL, temperature, maxTokens } = modelConfig
  const modelProvider = normalizeModelProvider(provider)
  const modelIdentifier = `${modelProvider}:${model}`

  if (modelProvider === 'anthropic') {
    return await initChatModel(modelIdentifier, {
      apiKey,
      anthropicApiUrl: baseURL,
      temperature,
      maxTokens,
      streaming: true,
    })
  }

  if (modelProvider === 'google-genai') {
    return await initChatModel(modelIdentifier, {
      apiKey,
      baseUrl: baseURL,
      temperature,
      maxTokens,
      streaming: true,
    })
  }

  if (modelProvider === 'ollama') {
    const headers = buildOllamaHeaders(apiKey)

    return await initChatModel(modelIdentifier, {
      baseUrl: normalizeOllamaBaseUrl(baseURL),
      ...(headers ? { headers } : {}),
      temperature,
      numCtx: maxTokens,
      streaming: true,
    })
  }

  return await initChatModel(modelIdentifier, {
    apiKey,
    temperature,
    maxTokens,
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
