import type { AIMessageChunk } from '@langchain/core/messages'
import { HumanMessage, ToolMessage } from '@langchain/core/messages'
import { LLMock } from '@copilotkit/aimock'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { buildSessionModel } from '../../session/session-builder-model'
import { LangChainTelemetryHandler } from '../langchain-telemetry-handler'

function extractChunkText(chunk: AIMessageChunk) {
  const { content } = chunk

  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part
        }

        return typeof part?.text === 'string' ? part.text : ''
      })
      .join('')
  }

  return ''
}

describe('LangChain transparency with aimock', () => {
  const mock = new LLMock({ port: 0 })
  let started = false

  beforeAll(async () => {
    await mock.start()
    started = true
  })

  afterAll(async () => {
    if (started) {
      await mock.stop()
    }
  })

  beforeEach(() => {
    mock.reset()
  })

  it('captures telemetry for a real streamed response over the provider protocol', async () => {
    mock.onMessage(
      'stream telemetry',
      { content: 'Hello from aimock streaming telemetry.' },
      { chunkSize: 6, latency: 5 },
    )

    const telemetry = new LangChainTelemetryHandler({
      provider: 'openai',
      model: 'gpt-4o-mini',
    })

    const model = await buildSessionModel({
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'test-key',
      baseURL: `${mock.url}/v1`,
    })

    const stream = await model.stream(
      [new HumanMessage('stream telemetry please')],
      { callbacks: [telemetry] },
    )

    let output = ''

    for await (const chunk of stream) {
      output += extractChunkText(chunk as AIMessageChunk)
    }

    const snapshot = telemetry.snapshot()

    expect(output).toContain('aimock')
    expect(snapshot.input?.charCount).toBeGreaterThan(0)
    expect(snapshot.output?.charCount).toBeGreaterThan(0)
    expect(snapshot.execution?.llmRuns).toBe(1)
    expect(snapshot.execution?.startedAt).toBeTruthy()
    expect(snapshot.execution?.firstTokenAt).toBeTruthy()
    expect(snapshot.execution?.completedAt).toBeTruthy()
    expect(snapshot.execution?.lastRunStatus).toBe('completed')
    expect(snapshot.execution?.lastRunCompletedAt).toBeTruthy()
    expect(snapshot.usage.totalEstimatedTokens).toBeGreaterThan(0)
  })

  it('preserves partial telemetry when the provider stream is truncated mid-response', async () => {
    mock.onMessage(
      'truncate telemetry',
      { content: 'This response should be cut off before completion.' },
      { chunkSize: 5, truncateAfterChunks: 3, latency: 5 },
    )

    const telemetry = new LangChainTelemetryHandler({
      provider: 'openai',
      model: 'gpt-4o-mini',
    })

    const model = await buildSessionModel({
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'test-key',
      baseURL: `${mock.url}/v1`,
    })

    const stream = await model.stream(
      [new HumanMessage('truncate telemetry please')],
      { callbacks: [telemetry] },
    )

    let output = ''
    let streamError: unknown = null

    try {
      for await (const chunk of stream) {
        output += extractChunkText(chunk as AIMessageChunk)
      }
    }
    catch (error) {
      streamError = error
      telemetry.markInterrupted(error instanceof Error ? error.message : String(error))
    }

    const snapshot = telemetry.snapshot()

    expect(streamError).toBeTruthy()
    expect(output.length).toBeGreaterThan(0)
    expect(output.length).toBeLessThan('This response should be cut off before completion.'.length)
    expect(snapshot.execution?.startedAt).toBeTruthy()
    expect(snapshot.execution?.firstTokenAt).toBeTruthy()
    expect(snapshot.output?.charCount).toBeGreaterThan(0)
    expect(snapshot.execution?.completedAt).toBeFalsy()
    expect(snapshot.execution?.lastRunStatus).toBe('interrupted')
    expect(snapshot.execution?.lastRunError).toBeTruthy()
  })

  it('keeps request journal and partial output when the provider disconnects mid-stream', async () => {
    mock.onMessage(
      'disconnect telemetry',
      { content: 'This stream disconnects after a short partial output.' },
      { chunkSize: 4, disconnectAfterMs: 60, latency: 10 },
    )

    const telemetry = new LangChainTelemetryHandler({
      provider: 'openai',
      model: 'gpt-4o-mini',
    })

    const model = await buildSessionModel({
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'test-key',
      baseURL: `${mock.url}/v1`,
    })

    const stream = await model.stream(
      [new HumanMessage('disconnect telemetry please')],
      { callbacks: [telemetry] },
    )

    let output = ''
    let streamError: unknown = null

    try {
      for await (const chunk of stream) {
        output += extractChunkText(chunk as AIMessageChunk)
      }
    }
    catch (error) {
      streamError = error
      telemetry.markInterrupted(error instanceof Error ? error.message : String(error))
    }

    const snapshot = telemetry.snapshot()
    const lastRequest = mock.getLastRequest()

    expect(streamError).toBeTruthy()
    expect(output.length).toBeGreaterThan(0)
    expect(output.length).toBeLessThan('This stream disconnects after a short partial output.'.length)
    expect(snapshot.execution?.startedAt).toBeTruthy()
    expect(snapshot.execution?.firstTokenAt).toBeTruthy()
    expect(snapshot.execution?.completedAt).toBeFalsy()
    expect(snapshot.execution?.lastRunStatus).toBe('interrupted')
    expect(snapshot.execution?.lastRunError).toBeTruthy()
    expect(lastRequest).toBeTruthy()
    expect(lastRequest?.path).toBe('/v1/chat/completions')
    expect(JSON.stringify(lastRequest?.body ?? {})).toContain('disconnect telemetry please')
    expect(lastRequest?.response.interrupted).toBe(true)
  })

  it('captures a partial tool-call trace when the provider disconnects after the tool name chunk', async () => {
    mock.onMessage(
      'tool disconnect',
      {
        toolCalls: [
          {
            name: 'weather_lookup',
            arguments: '{"city":"Shanghai"}',
          },
        ],
      },
      { disconnectAfterMs: 25, latency: 10 },
    )

    const telemetry = new LangChainTelemetryHandler({
      provider: 'openai',
      model: 'gpt-4o-mini',
    })

    const model = await buildSessionModel({
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'test-key',
      baseURL: `${mock.url}/v1`,
    })

    const toolModel = model.bindTools([
      {
        name: 'weather_lookup',
        description: 'Look up weather',
        schema: z.object({
          city: z.string(),
        }),
      },
    ])

    const stream = await toolModel.stream(
      [new HumanMessage('tool disconnect please')],
      { callbacks: [telemetry] },
    )

    let streamError: unknown = null
    let sawToolNameChunk = false
    let sawResolvedToolCall = false

    try {
      for await (const chunk of stream) {
        const aiChunk = chunk as AIMessageChunk

        if (aiChunk.tool_call_chunks?.some(toolChunk => toolChunk.name === 'weather_lookup')) {
          sawToolNameChunk = true
        }

        if (aiChunk.tool_calls?.some(toolCall => toolCall.name === 'weather_lookup')) {
          sawResolvedToolCall = true
        }
      }
    }
    catch (error) {
      streamError = error
      telemetry.markInterrupted(error instanceof Error ? error.message : String(error))
    }

    const snapshot = telemetry.snapshot()
    const lastRequest = mock.getLastRequest()

    expect(streamError).toBeTruthy()
    expect(sawToolNameChunk).toBe(true)
    expect(sawResolvedToolCall).toBe(true)
    expect(snapshot.execution?.llmRuns).toBe(1)
    expect(snapshot.execution?.startedAt).toBeTruthy()
    expect(snapshot.execution?.completedAt).toBeFalsy()
    expect(snapshot.execution?.toolCalls).toBe(0)
    expect(snapshot.execution?.lastRunStatus).toBe('interrupted')
    expect(snapshot.execution?.lastRunError).toBeTruthy()
    expect(lastRequest?.path).toBe('/v1/chat/completions')
    expect(JSON.stringify(lastRequest?.body ?? {})).toContain('weather_lookup')
    expect(lastRequest?.response.interrupted).toBe(true)
    expect(lastRequest?.response.interruptReason).toBe('disconnectAfterMs')
  })

  it('keeps the tool step complete while the final answer disconnects after the tool result round-trip', async () => {
    mock.onMessage(
      'tool then answer',
      {
        toolCalls: [
          {
            name: 'weather_lookup',
            arguments: '{"city":"Shanghai"}',
          },
        ],
      },
    )

    mock.prependFixture({
      match: {
        predicate: req => req.messages.at(-1)?.role === 'tool',
      },
      response: {
        content: 'The weather is sunny in Shanghai today, with light wind and clear skies for the rest of the afternoon.',
      },
      disconnectAfterMs: 35,
      latency: 10,
      chunkSize: 8,
    })

    const telemetry = new LangChainTelemetryHandler({
      provider: 'openai',
      model: 'gpt-4o-mini',
    })

    const model = await buildSessionModel({
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'test-key',
      baseURL: `${mock.url}/v1`,
    })

    const toolModel = model.bindTools([
      {
        name: 'weather_lookup',
        description: 'Look up weather',
        schema: z.object({
          city: z.string(),
        }),
      },
    ])

    const firstResponse = await toolModel.invoke(
      [new HumanMessage('tool then answer please')],
      { callbacks: [telemetry] },
    )

    const toolCallId = firstResponse.tool_calls?.[0]?.id
    expect(toolCallId).toBeTruthy()
    expect(firstResponse.tool_calls?.[0]?.name).toBe('weather_lookup')

    const stream = await model.stream(
      [
        new HumanMessage('tool then answer please'),
        firstResponse,
        new ToolMessage({
          tool_call_id: toolCallId!,
          content: '{"temp":25,"condition":"sunny"}',
        }),
      ],
      { callbacks: [telemetry] },
    )

    let partialAnswer = ''
    let streamError: unknown = null

    try {
      for await (const chunk of stream) {
        partialAnswer += extractChunkText(chunk as AIMessageChunk)
      }
    }
    catch (error) {
      streamError = error
      telemetry.markInterrupted(error instanceof Error ? error.message : String(error))
    }

    const snapshot = telemetry.snapshot()
    const requests = mock.getRequests()
    const finalAnswerRequest = requests.at(-1)

    expect(streamError).toBeTruthy()
    expect(partialAnswer.length).toBeGreaterThan(0)
    expect(partialAnswer).toContain('weather')
    expect(partialAnswer.length).toBeLessThan('The weather is sunny in Shanghai today, with light wind and clear skies for the rest of the afternoon.'.length)
    expect(snapshot.execution?.llmRuns).toBe(2)
    expect(snapshot.execution?.startedAt).toBeTruthy()
    expect(snapshot.output?.charCount).toBeGreaterThan(0)
    expect(snapshot.execution?.lastRunStatus).toBe('interrupted')
    expect(snapshot.execution?.lastRunError).toBeTruthy()
    expect(requests).toHaveLength(2)
    expect(JSON.stringify(finalAnswerRequest?.body ?? {})).toContain('"role":"tool"')
    expect(finalAnswerRequest?.response.interrupted).toBe(true)
    expect(finalAnswerRequest?.response.interruptReason).toBe('disconnectAfterMs')
  })
})
