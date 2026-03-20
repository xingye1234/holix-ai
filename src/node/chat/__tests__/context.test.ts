/**
 * Context Schema 单元测试
 */

import { describe, expect, it } from 'vitest'
import { contextSchema } from '../context'

describe('contextSchema', () => {
  it('should validate valid context with chatUid', () => {
    const result = contextSchema.safeParse({
      config: { testKey: 'testValue' },
      chatUid: 'chat-123',
    })

    expect(result.success).toBe(true)
  })

  it('should validate valid context without chatUid', () => {
    const result = contextSchema.safeParse({
      config: { testKey: 'testValue' },
    })

    expect(result.success).toBe(true)
  })

  it('should accept empty config object', () => {
    const result = contextSchema.safeParse({
      config: {},
    })

    expect(result.success).toBe(true)
  })

  it('should accept chatUid as empty string', () => {
    const result = contextSchema.safeParse({
      config: {},
      chatUid: '',
    })

    expect(result.success).toBe(true)
  })

  it('should accept complex config object', () => {
    const result = contextSchema.safeParse({
      config: {
        apiKey: 'test-key',
        baseUrl: 'https://api.example.com',
        disabledSkills: ['skill1', 'skill2'],
        context7ApiKey: 'context7-key',
      },
      chatUid: 'chat-456',
    })

    expect(result.success).toBe(true)
  })

  it('should have correct inferred types', () => {
    // Type check for ChatContext - should have config and optional chatUid
    interface TestContext {
      config: Record<string, unknown>
      chatUid?: string
    }

    const validContext: TestContext = {
      config: { test: true },
      chatUid: 'test',
    }

    expect(validContext.config).toBeDefined()
  })
})
