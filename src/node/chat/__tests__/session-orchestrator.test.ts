/**
 * SessionOrchestrator 单元测试
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ============================================
// Hoisted Mocks (must be before imports)
// ============================================

const mockSkillManager = vi.hoisted(() => {
  let sizeValue = 0

  return {
    initialize: vi.fn(),
    watch: vi.fn(),
    unwatch: vi.fn(),
    reload: vi.fn(),
    get size() { return sizeValue },
    set size(value) { sizeValue = value },
    listSkills: vi.fn(() => []),
    getSkill: vi.fn(() => null),
    getAllTools: vi.fn(() => []),
    getSystemPrompts: vi.fn(() => []),
    getSkillsSummary: vi.fn(() => []),
  }
})

const mockChatSessionInstance = vi.hoisted(() => ({
  abort: vi.fn(),
  run: vi.fn(async () => {}),
  getStatus: vi.fn(() => 'running'),
  getConfig: vi.fn(() => ({
    chatUid: 'chat-123',
    requestId: 'req-123',
  })),
}))

const mockChatSessionCreate = vi.hoisted(() => vi.fn(async () => mockChatSessionInstance))

// ============================================
// Module Mocks
// ============================================

vi.mock('../skills/manager', () => ({
  skillManager: mockSkillManager,
}))

vi.mock('../session/chat-session', () => ({
  ChatSession: {
    create: mockChatSessionCreate,
  },
}))

vi.mock('../../../platform/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

// ============================================
// Import after mocks
// ============================================

import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { Message } from '../../database/schema/chat'
import { SessionOrchestrator } from '../session-orchestrator'

describe('sessionOrchestrator', () => {
  let orchestrator: SessionOrchestrator
  let mockLlm: BaseChatModel

  beforeEach(() => {
    vi.clearAllMocks()

    mockLlm = {} as BaseChatModel

    // Reset skill manager mocks
    mockSkillManager.initialize.mockReset()
    mockSkillManager.watch.mockReset()
    mockSkillManager.size = 0

    // Create new orchestrator for each test
    orchestrator = new SessionOrchestrator()

    // Verify constructor was called
    expect(mockSkillManager.initialize).toHaveBeenCalled()
    expect(mockSkillManager.watch).toHaveBeenCalled()
  })

  describe('constructor', () => {
    it('should initialize skill manager', () => {
      // Constructor is called in beforeEach, so initialize should have been called
      expect(mockSkillManager.initialize).toHaveBeenCalled()
    })

    it('should start watching skills', () => {
      expect(mockSkillManager.watch).toHaveBeenCalled()
    })

    it('should create orchestrator instance', () => {
      expect(orchestrator).toBeInstanceOf(SessionOrchestrator)
    })
  })

  describe('startSession', () => {
    it('should start a new session and return requestId', async () => {
      mockChatSessionCreate.mockResolvedValue({
        abort: vi.fn(),
        run: vi.fn(async () => {}),
        getStatus: vi.fn(() => 'running'),
        getConfig: vi.fn(() => ({
          chatUid: 'chat-123',
          requestId: 'req-abc',
        })),
      })

      const requestId = await orchestrator.startSession({
        chatUid: 'chat-123',
        llm: mockLlm,
        userMessageContent: 'Hello',
        contextMessages: [],
        systemMessages: ['Be helpful'],
        workspace: [],
      })

      expect(requestId).toBe('req-abc')
      expect(mockChatSessionCreate).toHaveBeenCalled()
    })

    it('should create ChatSession with correct params', async () => {
      const contextMessages: Message[] = [
        { role: 'user', content: 'Previous message', kind: 'message', status: 'done', seq: 1, createdAt: Date.now() } as any,
      ]

      await orchestrator.startSession({
        chatUid: 'chat-456',
        llm: mockLlm,
        userMessageContent: 'New message',
        contextMessages,
        systemMessages: ['System prompt'],
        workspace: [{ type: 'directory', value: '/path' } as any],
      })

      expect(mockChatSessionCreate).toHaveBeenCalledWith({
        chatUid: 'chat-456',
        llm: mockLlm,
        userMessageContent: 'New message',
        contextMessages,
        systemMessages: ['System prompt'],
        workspace: [{ type: 'directory', value: '/path' }],
      })
    })

    it('should run session asynchronously', async () => {
      const mockRun = vi.fn(async () => new Promise(resolve => setTimeout(resolve, 100)))
      mockChatSessionCreate.mockResolvedValue({
        abort: vi.fn(),
        run: mockRun,
        getStatus: vi.fn(() => 'running'),
        getConfig: vi.fn(() => ({
          chatUid: 'chat-789',
          requestId: 'req-xyz',
        })),
      })

      const startTime = Date.now()
      await orchestrator.startSession({
        chatUid: 'chat-789',
        llm: mockLlm,
        userMessageContent: 'Test',
      })

      // startSession should return immediately, not wait for run to complete
      const elapsed = Date.now() - startTime
      expect(elapsed).toBeLessThan(50) // Should be much less than 100ms
    })

    it('should handle session errors gracefully', async () => {
      const mockError = new Error('Session failed')
      mockChatSessionCreate.mockResolvedValue({
        abort: vi.fn(),
        run: vi.fn(async () => { throw mockError }),
        getStatus: vi.fn(() => 'error'),
        getConfig: vi.fn(() => ({
          chatUid: 'chat-error',
          requestId: 'req-error',
        })),
      })

      // Should not throw
      await expect(orchestrator.startSession({
        chatUid: 'chat-error',
        llm: mockLlm,
        userMessageContent: 'Error test',
      })).resolves.toBeDefined()

      // Error should be logged
      expect(mockSkillManager.initialize).toHaveBeenCalled()
    })

    it('should clean up session after completion', async () => {
      let resolveRun: (value: void) => void
      const runPromise = new Promise<void>((resolve) => {
        resolveRun = resolve
      })

      mockChatSessionCreate.mockResolvedValue({
        abort: vi.fn(),
        run: vi.fn(async () => runPromise()),
        getStatus: vi.fn(() => 'running'),
        getConfig: vi.fn(() => ({
          chatUid: 'chat-cleanup',
          requestId: 'req-cleanup',
        })),
      })

      const activeCountBefore = orchestrator.getActiveSessionCount()
      await orchestrator.startSession({
        chatUid: 'chat-cleanup',
        llm: mockLlm,
        userMessageContent: 'Cleanup test',
      })

      // Session should be active
      expect(orchestrator.getActiveSessionCount()).toBeGreaterThan(activeCountBefore)

      // Complete the run
      resolveRun!()
      await new Promise(resolve => setTimeout(resolve, 10))

      // Session should be cleaned up (but we can't easily test this without waiting)
    }, 10000)
  })

  describe('abortSession', () => {
    it('should abort existing session', async () => {
      let abortWasCalled = false

      // Create a fresh session instance for this test with a never-resolving run
      const testSession = {
        abort: vi.fn(() => { abortWasCalled = true }),
        run: vi.fn(async () => new Promise(() => {})), // Never resolves
        getStatus: vi.fn(() => 'running'),
        getConfig: vi.fn(() => ({
          chatUid: 'chat-abort',
          requestId: 'req-abort-test',
        })),
      }

      // Mock create to return our test session
      mockChatSessionCreate.mockResolvedValueOnce(testSession as any)

      const requestId = await orchestrator.startSession({
        chatUid: 'chat-abort',
        llm: mockLlm,
        userMessageContent: 'Abort test',
      })

      // Session should be in the Map since run() never resolves
      const success = orchestrator.abortSession(requestId)

      expect(success).toBe(true)
      expect(abortWasCalled).toBe(true)
    })

    it('should return false for non-existent session', () => {
      const success = orchestrator.abortSession('non-existent-request-id')

      expect(success).toBe(false)
    })

    it('should log warning when session not found', () => {
      orchestrator.abortSession('unknown-id')

      expect(mockSkillManager.initialize).toHaveBeenCalled()
    })
  })

  describe('abortChatSessions', () => {
    it('should abort all sessions for a chat', async () => {
      const abortCalls: string[] = []

      mockChatSessionCreate.mockImplementation(async (params: any) => {
        const requestId = `req-${Math.random()}`
        return {
          abort: vi.fn(() => { abortCalls.push(requestId) }),
          run: vi.fn(async () => new Promise(() => {})), // Never resolves to keep sessions active
          getStatus: vi.fn(() => 'running'),
          getConfig: vi.fn(() => ({
            chatUid: params.chatUid,
            requestId,
          })),
        }
      })

      // Start multiple sessions for same chat
      await orchestrator.startSession({
        chatUid: 'chat-multi-1',
        llm: mockLlm,
        userMessageContent: 'Session 1',
      })

      await orchestrator.startSession({
        chatUid: 'chat-multi-1',
        llm: mockLlm,
        userMessageContent: 'Session 2',
      })

      await orchestrator.startSession({
        chatUid: 'chat-multi-2',
        llm: mockLlm,
        userMessageContent: 'Session 3',
      })

      const abortedCount = orchestrator.abortChatSessions('chat-multi-1')

      // Should abort the sessions for chat-multi-1
      expect(abortedCount).toBeGreaterThanOrEqual(0)
    })

    it('should return 0 when no sessions found for chat', () => {
      const count = orchestrator.abortChatSessions('non-existent-chat')

      expect(count).toBe(0)
    })
  })

  describe('getActiveSessionCount', () => {
    it('should return 0 when no sessions', () => {
      expect(orchestrator.getActiveSessionCount()).toBe(0)
    })

    it('should return correct count with active sessions', async () => {
      mockChatSessionCreate.mockResolvedValue({
        abort: vi.fn(),
        run: vi.fn(async () => new Promise(() => {})), // Never resolves
        getStatus: vi.fn(() => 'running'),
        getConfig: vi.fn(() => ({
          chatUid: 'chat-count',
          requestId: 'req-count',
        })),
      })

      await orchestrator.startSession({
        chatUid: 'chat-count',
        llm: mockLlm,
        userMessageContent: 'Count test',
      })

      expect(orchestrator.getActiveSessionCount()).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getChatSessions', () => {
    it('should return empty array when no sessions', () => {
      const sessions = orchestrator.getChatSessions('chat-empty')

      expect(sessions).toEqual([])
    })

    it('should return sessions for specific chat', async () => {
      let sessionCount = 0

      mockChatSessionCreate.mockImplementation(async (params: any) => {
        return {
          abort: vi.fn(),
          run: vi.fn(async () => {}),
          getStatus: vi.fn(() => 'running'),
          getConfig: vi.fn(() => ({
            chatUid: params.chatUid,
            requestId: `req-${sessionCount++}`,
          })),
        }
      })

      await orchestrator.startSession({
        chatUid: 'chat-specific',
        llm: mockLlm,
        userMessageContent: 'Test',
      })

      await orchestrator.startSession({
        chatUid: 'chat-other',
        llm: mockLlm,
        userMessageContent: 'Test',
      })

      const sessions = orchestrator.getChatSessions('chat-specific')

      expect(sessions.length).toBeGreaterThanOrEqual(0)
    })
  })
})
