import type { BaseMessage, BaseMessageChunk } from '@langchain/core/messages'
import type { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager'
import type { ChatResult } from '@langchain/core/outputs'
import type { LlmConfig } from '../types'
import { ChatGenerationChunk } from '@langchain/core/outputs'
import { AIMessage, AIMessageChunk } from '@langchain/core/messages'
import { ChatOpenAICompletions, convertCompletionsDeltaToBaseMessageChunk, convertCompletionsMessageToBaseMessage, convertMessagesToCompletionsMessageParams } from '@langchain/openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import process from 'node:process'

const KIMI_ASSISTANT_PASSTHROUGH_FIELDS = [
  'reasoning_content',
  'reasoning_details',
  'thinking',
] as const

type KimiAssistantPassthroughField = (typeof KIMI_ASSISTANT_PASSTHROUGH_FIELDS)[number]
type KimiAssistantPassthroughFields = Partial<Record<KimiAssistantPassthroughField, unknown>>
type KimiMessageParam = ChatCompletionMessageParam & Record<string, unknown>

export function isKimiProvider(config?: Pick<LlmConfig, 'provider' | 'baseURL'>) {
  const normalizedProvider = config?.provider?.toLowerCase()
  if (normalizedProvider === 'moonshot') {
    return true
  }

  const host = extractHost(config?.baseURL)
  return host !== null && /(?:^|\.)moonshot\.cn$/i.test(host)
}

export function createKimiProvider(model: string, config?: LlmConfig) {
  return new KimiChatModel({
    model,
    apiKey: config?.apiKey || process.env.OPENAI_API_KEY,
    temperature: config?.temperature ?? 0.7,
    maxTokens: config?.maxTokens,
    streaming: config?.streaming ?? true,
    configuration: {
      baseURL: config?.baseURL || process.env.OPENAI_BASE_URL || 'https://api.moonshot.cn/v1',
    },
  })
}

export function getKimiAssistantPassthroughFields(value: unknown): KimiAssistantPassthroughFields {
  if (!value || typeof value !== 'object') {
    return {}
  }

  const record = value as Record<string, unknown>
  const fields: KimiAssistantPassthroughFields = {}

  for (const key of KIMI_ASSISTANT_PASSTHROUGH_FIELDS) {
    const fieldValue = record[key]
    if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
      fields[key] = fieldValue
    }
  }

  return fields
}

export function hasKimiAssistantPassthroughFields(message: BaseMessage) {
  if (!AIMessage.isInstance(message)) {
    return false
  }

  return Object.keys(getKimiAssistantPassthroughFields(message.additional_kwargs)).length > 0
}

export function convertMessagesToKimiMessageParams(params: {
  messages: BaseMessage[]
  model?: string
}) {
  const converted: KimiMessageParam[] = []

  for (const message of params.messages) {
    const next = convertMessagesToCompletionsMessageParams({
      messages: [message],
      model: params.model,
    }).map(param => ({ ...param }) as KimiMessageParam)

    if (AIMessage.isInstance(message)) {
      const passthrough = getKimiAssistantPassthroughFields(message.additional_kwargs)
      if (Object.keys(passthrough).length > 0 && next.length > 0) {
        Object.assign(next[0], passthrough)
      }
    }

    converted.push(...next)
  }

  return converted
}

function mergeKimiAssistantPassthrough<T extends BaseMessage | BaseMessageChunk>(target: T, source: unknown): T {
  const passthrough = getKimiAssistantPassthroughFields(source)
  if (Object.keys(passthrough).length === 0) {
    return target
  }

  const currentAdditionalKwargs = ((target as any).additional_kwargs ?? {}) as Record<string, unknown>
  ;(target as any).additional_kwargs = {
    ...currentAdditionalKwargs,
    ...passthrough,
  }

  return target
}

function buildUsageMetadata(usage: any) {
  if (!usage) {
    return undefined
  }

  const inputTokenDetails = {
    ...(usage.prompt_tokens_details?.audio_tokens !== null && usage.prompt_tokens_details?.audio_tokens !== undefined
      ? { audio: usage.prompt_tokens_details.audio_tokens }
      : {}),
    ...(usage.prompt_tokens_details?.cached_tokens !== null && usage.prompt_tokens_details?.cached_tokens !== undefined
      ? { cache_read: usage.prompt_tokens_details.cached_tokens }
      : {}),
  }

  const outputTokenDetails = {
    ...(usage.completion_tokens_details?.audio_tokens !== null && usage.completion_tokens_details?.audio_tokens !== undefined
      ? { audio: usage.completion_tokens_details.audio_tokens }
      : {}),
    ...(usage.completion_tokens_details?.reasoning_tokens !== null && usage.completion_tokens_details?.reasoning_tokens !== undefined
      ? { reasoning: usage.completion_tokens_details.reasoning_tokens }
      : {}),
  }

  return {
    input_tokens: usage.prompt_tokens,
    output_tokens: usage.completion_tokens,
    total_tokens: usage.total_tokens,
    ...(Object.keys(inputTokenDetails).length > 0 ? { input_token_details: inputTokenDetails } : {}),
    ...(Object.keys(outputTokenDetails).length > 0 ? { output_token_details: outputTokenDetails } : {}),
  }
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

export class KimiChatModel extends ChatOpenAICompletions {
  protected override _convertCompletionsDeltaToBaseMessageChunk(
    delta: Record<string, any>,
    rawResponse: any,
    defaultRole?: string,
  ): BaseMessageChunk {
    const chunk = convertCompletionsDeltaToBaseMessageChunk({
      delta,
      rawResponse,
      includeRawResponse: (this as any).__includeRawResponse,
      defaultRole: defaultRole as any,
    })

    return mergeKimiAssistantPassthrough(chunk, delta)
  }

  protected override _convertCompletionsMessageToBaseMessage(
    message: Record<string, any>,
    rawResponse: any,
  ): BaseMessage {
    const baseMessage = convertCompletionsMessageToBaseMessage({
      message: message as any,
      rawResponse,
      includeRawResponse: (this as any).__includeRawResponse,
    })

    return mergeKimiAssistantPassthrough(baseMessage, message)
  }

  override async _generate(
    messages: BaseMessage[],
    options: any,
    runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    if (!messages.some(hasKimiAssistantPassthroughFields)) {
      return await super._generate(messages, options, runManager)
    }

    const data = await (this as any).completionWithRetry(
      {
        ...(this as any).invocationParams(options),
        messages: convertMessagesToKimiMessageParams({
          messages,
          model: (this as any).model,
        }),
        stream: false,
      },
      options,
    )

    const usageMetadata = buildUsageMetadata(data?.usage)
    const generations = (data?.choices ?? []).map((part: any) => {
      const text = part.message?.content ?? ''
      const message = this._convertCompletionsMessageToBaseMessage(
        part.message ?? { role: 'assistant' },
        data,
      ) as any

      if (AIMessage.isInstance(message) && usageMetadata) {
        message.usage_metadata = usageMetadata
      }

      return {
        text,
        message,
        generationInfo: {
          ...(part.finish_reason ? { finish_reason: part.finish_reason } : {}),
          ...(part.logprobs ? { logprobs: part.logprobs } : {}),
        },
      }
    })

    return {
      generations,
      llmOutput: {
        tokenUsage: {
          promptTokens: usageMetadata?.input_tokens ?? 0,
          completionTokens: usageMetadata?.output_tokens ?? 0,
          totalTokens: usageMetadata?.total_tokens ?? 0,
        },
      },
    }
  }

  override async* _streamResponseChunks(
    messages: BaseMessage[],
    options: any,
    runManager?: CallbackManagerForLLMRun,
  ): AsyncGenerator<ChatGenerationChunk> {
    if (!messages.some(hasKimiAssistantPassthroughFields)) {
      yield* super._streamResponseChunks(messages, options, runManager)
      return
    }

    const params = {
      ...(this as any).invocationParams(options, { streaming: true }),
      messages: convertMessagesToKimiMessageParams({
        messages,
        model: (this as any).model,
      }),
      stream: true as const,
    }

    let defaultRole: string | undefined
    const streamIterable = await (this as any).completionWithRetry(params, options)
    let usage: any

    for await (const data of streamIterable) {
      const choice = data?.choices?.[0]
      if (data?.usage) {
        usage = data.usage
      }
      if (!choice?.delta) {
        continue
      }

      const chunk = this._convertCompletionsDeltaToBaseMessageChunk(
        choice.delta,
        data,
        defaultRole,
      )
      defaultRole = choice.delta.role ?? defaultRole

      if (typeof chunk.content !== 'string') {
        continue
      }

      const generationInfo: Record<string, unknown> = {
        prompt: options.promptIndex ?? 0,
        completion: choice.index ?? 0,
      }

      if (choice.finish_reason != null) {
        generationInfo.finish_reason = choice.finish_reason
        generationInfo.system_fingerprint = data.system_fingerprint
        generationInfo.model_name = data.model
        generationInfo.service_tier = data.service_tier
      }

      if ((this as any).logprobs) {
        generationInfo.logprobs = choice.logprobs
      }

      const generationChunk = new ChatGenerationChunk({
        message: chunk as any,
        text: chunk.content,
        generationInfo,
      })

      yield generationChunk

      await runManager?.handleLLMNewToken(
        generationChunk.text ?? '',
        {
          prompt: options.promptIndex ?? 0,
          completion: choice.index ?? 0,
        },
        undefined,
        undefined,
        undefined,
        { chunk: generationChunk },
      )
    }

    if (usage) {
      yield new ChatGenerationChunk({
        message: new AIMessageChunk({
          content: '',
          response_metadata: {
            usage: { ...usage },
          },
          usage_metadata: buildUsageMetadata(usage),
        }),
        text: '',
      })
    }

    if (options.signal?.aborted) {
      throw new Error('AbortError')
    }
  }
}
