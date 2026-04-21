import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AgentOrchestrator } from '../orchestrator'
import { titleGeneratorAgent } from '../builtin/title-generator'

// Mock database
vi.mock('../../../database/connect', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
  },
}))

// Mock ContextProvider to avoid database calls
vi.mock('../context', () => ({
  contextProvider: {
    getContext: vi.fn(async (chatUid: string, hook: string, data?: unknown) => {
      const eventData = data as any
      return {
        chatUid,
        messages: eventData?.messages || [],
        chat: {
          uid: chatUid,
          title: eventData?.chat?.title || '新对话',
          provider: 'openai',
          model: 'gpt-4',
          status: 'active',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastSeq: eventData?.messages?.length || 0,
        } as any,
        event: {
          hook: hook as any,
          data,
        },
      }
    }),
  },
}))

const titleStateMocks = vi.hoisted(() => ({
  hasGeneratedInitialTitle: vi.fn(() => false),
}))

vi.mock('../../../database/chat-title-state', () => ({
  hasGeneratedInitialTitle: titleStateMocks.hasGeneratedInitialTitle,
}))

describe('Agent Lifecycle Integration (Unit)', () => {
  let orchestrator: AgentOrchestrator

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
    titleStateMocks.hasGeneratedInitialTitle.mockReturnValue(false)

    // Create new instance for each test
    orchestrator = new AgentOrchestrator(5000)
    orchestrator.registerAgent(titleGeneratorAgent, ['onMessageCompleted'], 10)
  })

  it('should execute agent and return suggestion', async () => {
    // Trigger hook
    const results = await orchestrator.triggerHook('onMessageCompleted', 'test-chat', {
      messages: [
        {
          role: 'user',
          content: 'What is TypeScript?',
        },
      ],
      chat: {
        title: '新对话',
      },
    } as any)

    // Verify execution
    expect(results.length).toBe(1)

    const titleResult = results.find(r => r.agentId === 'builtin:title-generator')
    expect(titleResult).toBeDefined()
    expect(titleResult?.status).toBe('suggest')
    expect(titleResult?.suggestion).toEqual({
      type: 'title',
      content: 'What is TypeScript?',
      metadata: {
        currentTitle: '新对话',
        messageCount: 1,
        reason: 'Default title detected',
      },
    })
  })

  it('should skip suggestion when title is not default', async () => {
    const results = await orchestrator.triggerHook('onMessageCompleted', 'test-chat', {
      messages: [],
      chat: {
        title: 'Existing Title',
      },
    } as any)

    expect(results).toEqual([])
  })

  it('should not suggest title again after the first generation', async () => {
    titleStateMocks.hasGeneratedInitialTitle.mockReturnValue(true)

    const messages = Array.from({ length: 5 }, (_, i) => ({
      role: 'user',
      content: `Message ${i + 1}`,
    }))

    const results = await orchestrator.triggerHook('onMessageCompleted', 'test-chat', {
      messages,
      chat: {
        title: 'Existing Title',
      },
    } as any)

    expect(results).toEqual([])
  })
})
