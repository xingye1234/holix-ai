import { AIMessage } from '@langchain/core/messages'
import { describe, expect, it } from 'vitest'
import { convertMessagesToKimiMessageParams, getKimiAssistantPassthroughFields, hasKimiAssistantPassthroughFields, isKimiProvider } from '../kimi'

describe('kimi provider', () => {
  it('extracts kimi passthrough reasoning fields', () => {
    expect(getKimiAssistantPassthroughFields({
      reasoning_content: 'step-by-step',
      foo: 'bar',
      reasoning_details: [{ text: 'detail' }],
    })).toEqual({
      reasoning_content: 'step-by-step',
      reasoning_details: [{ text: 'detail' }],
    })
  })

  it('detects assistant messages with kimi passthrough fields', () => {
    const message = new AIMessage({
      content: '',
      additional_kwargs: {
        reasoning_content: 'internal trace',
      },
    })

    expect(hasKimiAssistantPassthroughFields(message)).toBe(true)
  })

  it('replays kimi reasoning fields into completions params', () => {
    const message = new AIMessage({
      content: '',
      tool_calls: [{ id: 'call-1', name: 'search', args: { q: 'hello' } }],
      additional_kwargs: {
        reasoning_content: 'need to search first',
      },
    })

    const [param] = convertMessagesToKimiMessageParams({
      messages: [message],
      model: 'kimi-k2.5',
    }) as Array<Record<string, unknown>>

    expect(param.role).toBe('assistant')
    expect(param.reasoning_content).toBe('need to search first')
    expect(param.tool_calls).toBeTruthy()
  })

  it('matches moonshot provider names directly', () => {
    expect(isKimiProvider({ provider: 'moonshot' })).toBe(true)
  })

  it('matches moonshot hosts for custom provider configs', () => {
    expect(isKimiProvider({ provider: 'openai', baseURL: 'https://api.moonshot.cn/v1' })).toBe(true)
  })
})
