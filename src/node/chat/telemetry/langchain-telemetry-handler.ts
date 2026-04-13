import type { MessageTelemetry } from '../../database/schema/chat'
import type { BaseMessage } from '@langchain/core/messages'
import type { LLMResult } from '@langchain/core/outputs'
import { BaseCallbackHandler } from '@langchain/core/callbacks/base'
import { buildTextTelemetry } from './estimator'

interface LangChainTelemetryHandlerParams {
  provider: string
  model: string
}

export class LangChainTelemetryHandler extends BaseCallbackHandler {
  name = 'holix-langchain-telemetry'

  private telemetry: MessageTelemetry
  private streamedOutput = ''

  constructor(private readonly params: LangChainTelemetryHandlerParams) {
    super()

    this.telemetry = {
      version: 1,
      provider: params.provider,
      model: params.model,
      usage: {
        totalEstimatedTokens: 0,
      },
      execution: {
        llmRuns: 0,
        chainRuns: 0,
        toolCalls: 0,
        toolNames: [],
        lastRunStatus: 'running',
      },
    }
  }

  handleChatModelStart(_llm: any, messages: BaseMessage[][]): void {
    const flattened = messages.flat()
    const inputText = flattened
      .map(message => this.extractText(message.content))
      .join('\n')

    const input = buildTextTelemetry(inputText)
    this.telemetry.input = input
    this.telemetry.execution = {
      ...this.telemetry.execution!,
      llmRuns: this.telemetry.execution!.llmRuns + 1,
      startedAt: this.telemetry.execution?.startedAt ?? Date.now(),
      lastRunStartedAt: Date.now(),
      lastRunFirstTokenAt: undefined,
      lastRunCompletedAt: undefined,
      lastRunStatus: 'running',
      lastRunError: undefined,
    }
    this.updateTotal()
  }

  handleLLMNewToken(token: string): void {
    this.streamedOutput += token

    this.telemetry.output = buildTextTelemetry(this.streamedOutput)
    this.telemetry.execution = {
      ...this.telemetry.execution!,
      firstTokenAt: this.telemetry.execution?.firstTokenAt ?? Date.now(),
      lastRunFirstTokenAt: this.telemetry.execution?.lastRunFirstTokenAt ?? Date.now(),
    }
    this.updateTotal()
  }

  handleLLMEnd(output: LLMResult): void {
    if (!this.streamedOutput) {
      const text = output.generations
        .flat()
        .map((generation) => {
          const messageText = 'message' in generation && generation.message
            ? this.readObjectString(generation.message, 'content')
            : generation.text

          return this.extractText(messageText)
        })
        .join('\n')

      this.streamedOutput = text
      this.telemetry.output = buildTextTelemetry(text)
    }

    this.telemetry.execution = {
      ...this.telemetry.execution!,
      completedAt: Date.now(),
      lastRunCompletedAt: Date.now(),
      lastRunStatus: 'completed',
      lastRunError: undefined,
    }
    this.updateTotal()
  }

  handleChainStart(): void {
    this.telemetry.execution = {
      ...this.telemetry.execution!,
      chainRuns: this.telemetry.execution!.chainRuns + 1,
    }
  }

  handleToolStart(tool: any): void {
    const toolName = (tool?.name as string | undefined) || 'unknown-tool'
    const toolNames = new Set(this.telemetry.execution?.toolNames ?? [])
    toolNames.add(toolName)

    this.telemetry.execution = {
      ...this.telemetry.execution!,
      toolCalls: this.telemetry.execution!.toolCalls + 1,
      toolNames: Array.from(toolNames),
    }
  }

  snapshot(): MessageTelemetry {
    return {
      ...this.telemetry,
      execution: this.telemetry.execution
        ? {
            ...this.telemetry.execution,
            toolNames: [...this.telemetry.execution.toolNames],
          }
        : undefined,
    }
  }

  markInterrupted(reason?: string) {
    this.telemetry.execution = {
      ...this.telemetry.execution!,
      lastRunStatus: 'interrupted',
      lastRunError: reason,
    }
  }

  markAborted(reason?: string) {
    this.telemetry.execution = {
      ...this.telemetry.execution!,
      lastRunStatus: 'aborted',
      lastRunError: reason,
    }
  }

  markError(reason?: string) {
    this.telemetry.execution = {
      ...this.telemetry.execution!,
      lastRunStatus: 'error',
      lastRunError: reason,
    }
  }

  private updateTotal() {
    this.telemetry.usage = {
      totalEstimatedTokens:
        (this.telemetry.input?.estimatedTokens ?? 0)
        + (this.telemetry.output?.estimatedTokens ?? 0),
    }
  }

  private extractText(value: unknown): string {
    if (typeof value === 'string')
      return value

    if (Array.isArray(value)) {
      return value
        .map((part) => {
          if (typeof part === 'string')
            return part
          return this.readObjectString(part, 'text')
        })
        .join('\n')
    }

    return ''
  }

  private readObjectString(value: unknown, key: string): string {
    if (!value || typeof value !== 'object')
      return ''

    const record = value as Record<string, unknown>
    return typeof record[key] === 'string' ? record[key] : ''
  }
}
