import type { BaseMessage, BaseMessageChunk } from '@langchain/core/messages'
import type { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager'
import type { ChatResult } from '@langchain/core/outputs'
import { AIMessage, ChatGenerationChunk } from '@langchain/core/messages'
import { AIMessageChunk } from '@langchain/core/messages'
import { ChatOpenAICompletions, convertCompletionsDeltaToBaseMessageChunk, convertCompletionsMessageToBaseMessage, convertMessagesToCompletionsMessageParams } from '@langchain/openai'

const ASSISTANT_PASSTHROUGH_FIELDS = [
  'reasoning_content',
  'reasoning_details',
  'thinking',
] as const

type AssistantPassthroughField = (typeof ASSISTANT_PASSTHROUGH_FIELDS)[number]

type AssistantPassthroughFields = Partial<Record<AssistantPassthroughField, unknown>>

export function getAssistantPassthroughFields(value: unknown): AssistantPassthroughFields {
  if (!value || typeof value !== 'object') {
    return {}
  }

  const record = value as Record<string, unknown>
  const fields: AssistantPassthroughFields = {}

  for (const key of ASSISTANT_PASSTHROUGH_FIELDS) {
    const fieldValue = record[key]
    if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
      fields[key] = fieldValue
    }
  }

  return fields
}

export function hasAssistantPassthroughFields(message: BaseMessage): boolean {
  if (!AIMessage.isInstance(message)) {
    return false
  }

  return Object.keys(getAssistantPassthroughFields(message.additional_kwargs)).length > 0
}

export function convertMessagesToCompatibleCompletionsMessageParams(params: {
  messages: BaseMessage[]
  model?: string
}) {
  const converted: Array<Record<string, unknown>> = []

  for (const message of params.messages) {
    const next = convertMessagesToCompletionsMessageParams({
      messages: [message],
      model: params.model,
    }) as Array<Record<string, unknown>>

    if (AIMessage.isInstance(message)) {
      const passthrough = getAssistantPassthroughFields(message.additional_kwargs)
      if (Object.keys(passthrough).length > 0 && next.length > 0) {
        Object.assign(next[0], passthrough)
      }
    }

    converted.push(...next)
  }

  return converted
}

export function enhanceOpenAICompatibleErrorMessage(params: {
  provider: string
  model: string
  baseURL?: string
  error: string
}): string {
  const { provider, model, error } = params
  const normalizedProvider = provider.toLowerCase()
  const lowerError = error.toLowerCase()

  if (
    /reasoning_content|reasoning_details/.test(lowerError)
    && /tool call|assistant tool call message|index \d+/.test(lowerError)
  ) {
    return `${error}\n\nProvider hint: this OpenAI-compatible model expects the assistant thinking payload to be echoed back together with the tool call during the same agent loop. Holix now preserves provider-specific reasoning fields, but retrying this request is still required if the in-flight state was created before this fix.`
  }

  if (/tool_call_id not found/.test(lowerError)) {
    return `${error}\n\nProvider hint: the provider expects the original assistant tool_call message to be preserved verbatim before the matching tool result. This usually means the upstream assistant payload was partially dropped in the tool loop.`
  }

  if (
    normalizedProvider === 'deepseek'
    && model.toLowerCase() === 'deepseek-reasoner'
    && /temperature|top_p|presence_penalty|frequency_penalty|logprobs|top_logprobs/.test(lowerError)
  ) {
    return `${error}\n\nProvider hint: DeepSeek documents that \`deepseek-reasoner\` rejects sampling and logprob-style parameters. Clear custom temperature or other sampling overrides for this chat and retry.`
  }

  return error
}

function mergeAssistantPassthrough<T extends BaseMessage | BaseMessageChunk>(
  target: T,
  source: unknown,
): T {
  const passthrough = getAssistantPassthroughFields(source)
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

export class CompatibleChatOpenAI extends ChatOpenAICompletions {
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

    return mergeAssistantPassthrough(chunk, delta)
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

    return mergeAssistantPassthrough(baseMessage, message)
  }

  override async _generate(
    messages: BaseMessage[],
    options: any,
    runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    if (!messages.some(hasAssistantPassthroughFields)) {
      return await super._generate(messages, options, runManager)
    }

    const data = await (this as any).completionWithRetry(
      {
        ...(this as any).invocationParams(options),
        messages: convertMessagesToCompatibleCompletionsMessageParams({
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

  override async *_streamResponseChunks(
    messages: BaseMessage[],
    options: any,
    runManager?: CallbackManagerForLLMRun,
  ): AsyncGenerator<ChatGenerationChunk> {
    if (!messages.some(hasAssistantPassthroughFields)) {
      yield* super._streamResponseChunks(messages, options, runManager)
      return
    }

    const params = {
      ...(this as any).invocationParams(options, { streaming: true }),
      messages: convertMessagesToCompatibleCompletionsMessageParams({
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
