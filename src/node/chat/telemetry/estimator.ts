import type { MessageTelemetry } from '../../database/schema/chat'
import { estimateTokens } from '@/share/token'

export function buildTextTelemetry(text: string) {
  return {
    charCount: text.length,
    estimatedTokens: estimateTokens(text),
  }
}

export function buildUserMessageTelemetry(params: {
  content: string
  provider?: string
  model?: string
}): MessageTelemetry {
  const input = buildTextTelemetry(params.content)

  return {
    version: 1,
    provider: params.provider,
    model: params.model,
    input,
    usage: {
      totalEstimatedTokens: input.estimatedTokens,
    },
    execution: {
      llmRuns: 0,
      chainRuns: 0,
      toolCalls: 0,
      toolNames: [],
    },
  }
}
