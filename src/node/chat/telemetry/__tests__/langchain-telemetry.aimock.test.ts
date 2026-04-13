import type { AIMessageChunk } from '@langchain/core/messages'
import { HumanMessage } from '@langchain/core/messages'
import { LLMock } from '@copilotkit/aimock'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
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
    }

    const snapshot = telemetry.snapshot()

    expect(streamError).toBeTruthy()
    expect(output.length).toBeGreaterThan(0)
    expect(output.length).toBeLessThan('This response should be cut off before completion.'.length)
    expect(snapshot.execution?.startedAt).toBeTruthy()
    expect(snapshot.execution?.firstTokenAt).toBeTruthy()
    expect(snapshot.output?.charCount).toBeGreaterThan(0)
    expect(snapshot.execution?.completedAt).toBeFalsy()
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
    }

    const snapshot = telemetry.snapshot()
    const lastRequest = mock.getLastRequest()

    expect(streamError).toBeTruthy()
    expect(output.length).toBeGreaterThan(0)
    expect(output.length).toBeLessThan('This stream disconnects after a short partial output.'.length)
    expect(snapshot.execution?.startedAt).toBeTruthy()
    expect(snapshot.execution?.firstTokenAt).toBeTruthy()
    expect(snapshot.execution?.completedAt).toBeFalsy()
    expect(lastRequest).toBeTruthy()
    expect(lastRequest?.path).toBe('/v1/chat/completions')
    expect(JSON.stringify(lastRequest?.body ?? {})).toContain('disconnect telemetry please')
    expect(lastRequest?.response.interrupted).toBe(true)
  })
})
