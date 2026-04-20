import { AIMessage } from '@langchain/core/messages'
import { describe, expect, it } from 'vitest'
import { convertMessagesToCompatibleCompletionsMessageParams, enhanceOpenAICompatibleErrorMessage, getAssistantPassthroughFields, hasAssistantPassthroughFields } from '../openai-compatible'

describe('openai-compatible helpers', () => {
  it('extracts assistant passthrough reasoning fields', () => {
    expect(getAssistantPassthroughFields({
      reasoning_content: 'step-by-step',
      foo: 'bar',
      reasoning_details: [{ text: 'detail' }],
    })).toEqual({
      reasoning_content: 'step-by-step',
      reasoning_details: [{ text: 'detail' }],
    })
  })

  it('detects assistant messages with provider-specific reasoning fields', () => {
    const message = new AIMessage({
      content: '',
      additional_kwargs: {
        reasoning_content: 'internal trace',
      },
    })

    expect(hasAssistantPassthroughFields(message)).toBe(true)
  })

  it('replays provider-specific reasoning fields into completions params', () => {
    const message = new AIMessage({
      content: '',
      tool_calls: [{ id: 'call-1', name: 'search', args: { q: 'hello' } }],
      additional_kwargs: {
        reasoning_content: 'need to search first',
      },
    })

    const [param] = convertMessagesToCompatibleCompletionsMessageParams({
      messages: [message],
      model: 'kimi-k2.5',
    }) as Array<Record<string, unknown>>

    expect(param.role).toBe('assistant')
    expect(param.reasoning_content).toBe('need to search first')
    expect(param.tool_calls).toBeTruthy()
  })

  it('adds provider-specific error hints for missing reasoning replay', () => {
    const message = enhanceOpenAICompatibleErrorMessage({
      provider: 'moonshot',
      model: 'kimi-k2.5',
      error: '400 thinking is enabled but reasoning_content is missing in assistant tool call message at index 3',
    })

    expect(message).toContain('Provider hint:')
    expect(message).toContain('retrying this request')
  })

  it('adds deepseek parameter guidance for reasoner models', () => {
    const message = enhanceOpenAICompatibleErrorMessage({
      provider: 'deepseek',
      model: 'deepseek-reasoner',
      error: '400 unsupported parameter: temperature',
    })

    expect(message).toContain('deepseek-reasoner')
    expect(message).toContain('temperature')
  })
})
