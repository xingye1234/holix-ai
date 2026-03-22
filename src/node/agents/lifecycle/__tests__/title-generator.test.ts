import { describe, it, expect, beforeEach, vi } from 'vitest'
import { titleGeneratorAgent } from '../builtin/title-generator'
import type { AgentContext } from '../types'

describe('TitleGenerator Agent (Unit)', () => {
  it('should suggest title when title is default', async () => {
    const mockContext: AgentContext = {
      chatUid: 'test-chat',
      messages: [
        {
          uid: '1',
          seq: 1,
          role: 'user',
          kind: 'message',
          content: 'What is TypeScript?',
          status: 'done',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          chatUid: 'test-chat',
        } as any,
      ],
      chat: {
        uid: 'test-chat',
        title: '新对话',
        provider: 'openai',
        model: 'gpt-4',
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastSeq: 1,
      } as any,
      event: {
        hook: 'onMessageCompleted',
        data: {},
      },
    }

    const result = await titleGeneratorAgent.handler(mockContext)

    expect(result.agentId).toBe('builtin:title-generator')
    expect(result.status).toBe('suggest')
    expect(result.suggestion).toEqual({
      type: 'title',
      content: 'What is TypeScript?',
      metadata: {
        currentTitle: '新对话',
        messageCount: 1,
        reason: 'Default title detected',
      },
    })
  })

  it('should skip suggestion when title exists and not at threshold', async () => {
    const mockContext: AgentContext = {
      chatUid: 'test-chat',
      messages: [] as any,
      chat: {
        uid: 'test-chat',
        title: 'Existing Title',
        provider: 'openai',
        model: 'gpt-4',
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastSeq: 0,
      } as any,
      event: {
        hook: 'onMessageCompleted',
        data: {},
      },
    }

    const result = await titleGeneratorAgent.handler(mockContext)

    expect(result.agentId).toBe('builtin:title-generator')
    expect(result.status).toBe('success')
    expect(result.suggestion).toBeUndefined()
  })

  it('should suggest title at message threshold (5 messages)', async () => {
    const messages = Array.from({ length: 5 }, (_, i) => ({
      uid: `${i}`,
      seq: i + 1,
      role: 'user',
      kind: 'message',
      content: `Message ${i + 1}`,
      status: 'done',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      chatUid: 'test-chat',
    } as any))

    const mockContext: AgentContext = {
      chatUid: 'test-chat',
      messages,
      chat: {
        uid: 'test-chat',
        title: 'Existing Title',
        provider: 'openai',
        model: 'gpt-4',
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastSeq: 5,
      } as any,
      event: {
        hook: 'onMessageCompleted',
        data: {},
      },
    }

    const result = await titleGeneratorAgent.handler(mockContext)

    expect(result.agentId).toBe('builtin:title-generator')
    expect(result.status).toBe('suggest')
    expect(result.suggestion?.metadata?.reason).toBe('Message threshold reached')
  })
})
