import type { createDeepAgent } from 'deepagents'
import type { SessionModelConfig } from './session-state'
import { CompatibleChatOpenAI } from '../llm/openai-compatible'
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

  if (shouldUseCompatibleOpenAIModel(modelConfig)) {
    return new CompatibleChatOpenAI({
      model,
      apiKey,
      temperature: shouldOmitTemperature(modelConfig) ? undefined : temperature,
      maxTokens,
      configuration: baseURL ? { baseURL } : undefined,
      streaming: true,
    })
  }

  return await initChatModel(modelIdentifier, {
    apiKey,
    temperature: shouldOmitTemperature(modelConfig) ? undefined : temperature,
    maxTokens,
    configuration: baseURL ? { baseURL } : undefined,
    streaming: true,
  })
}

export function shouldUseCompatibleOpenAIModel(modelConfig: SessionModelConfig) {
  const normalizedProvider = modelConfig.provider.toLowerCase()

  if (normalizedProvider !== 'openai') {
    return true
  }

  const host = extractHost(modelConfig.baseURL)
  return host !== null && !/(^|\.)openai\.com$/i.test(host)
}

export function shouldOmitTemperature(modelConfig: SessionModelConfig) {
  return modelConfig.provider.toLowerCase() === 'deepseek'
    && modelConfig.model.toLowerCase() === 'deepseek-reasoner'
}

function extractHost(baseURL?: string) {
  if (!baseURL) {
    return null
  }

  try {
    return new URL(baseURL).hostname.toLowerCase()
  }
  catch {
    return null
  }
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
