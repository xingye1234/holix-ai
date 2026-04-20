/**
 * Chat Init 单元测试
 */

import { describe, expect, it, vi } from 'vitest'

// ============================================
// Type Definitions
// ============================================

interface MessagePayload {
  chatId: string
  content: string
  replyTo: string | null
}

interface AbortPayload {
  requestId: string | null
  chatId: string | null
}

interface TestContextMessage {
  role: string
  content: string
  kind: string
  status: string
  seq: number
  createdAt: number
}

// ============================================
// Hoisted Mocks (must be before imports)
// ============================================

const mockOnCommand = vi.hoisted(() => vi.fn())

const mockSessionOrchestrator = vi.hoisted(() => ({
  startSession: vi.fn(async () => 'req-123'),
  abortSession: vi.fn(() => true),
  abortChatSessions: vi.fn(() => 0),
}))

const mockGetChatByUid = vi.hoisted(() => vi.fn())
const mockCreateUserMessage = vi.hoisted(() => vi.fn())
const mockGetLatestMessages = vi.hoisted(() => vi.fn())
const mockUpdateLastMessagePreview = vi.hoisted(() => vi.fn())
const mockUpdateChatTitle = vi.hoisted(() => vi.fn())
const mockUpdate = vi.hoisted(() => vi.fn())
const mockRunBuiltinSubAgent = vi.hoisted(() => vi.fn())
const mockProviderStore = vi.hoisted(() => ({
  get: vi.fn(() => [] as Array<{ name: string, apiType: string, apiKey: string, baseUrl: string, temperature?: number, maxTokens?: number }>),
  list: vi.fn(() => [] as Array<{ name: string, apiType: string, apiKey: string, baseUrl: string, temperature?: number, maxTokens?: number }>),
}))

// ============================================
// Module Mocks
// ============================================

vi.mock('../platform/commands', () => ({
  onCommand: mockOnCommand,
}))

vi.mock('../session-orchestrator', () => ({
  sessionOrchestrator: mockSessionOrchestrator,
}))

vi.mock('../../database/chat-operations', () => ({
  getChatByUid: mockGetChatByUid,
  updateChatTitle: mockUpdateChatTitle,
  updateLastMessagePreview: mockUpdateLastMessagePreview,
}))

vi.mock('../../database/message-operations', () => ({
  createUserMessage: mockCreateUserMessage,
  getLatestMessages: mockGetLatestMessages,
}))

vi.mock('../../database/schema/chat', () => ({
  DEFAULT_CHAT_CONTEXT_SETTINGS: {
    maxMessages: 10,
    timeWindowHours: null,
    autoScrollToBottomOnSend: true,
  },
}))

vi.mock('../platform/update', () => ({
  update: mockUpdate,
}))

vi.mock('../platform/provider', () => ({
  providerStore: mockProviderStore,
}))

vi.mock('../../agents/sub-agents', () => ({
  runBuiltinSubAgent: mockRunBuiltinSubAgent,
}))

// ============================================
// Import after mocks
// ============================================

import { initChat } from '../init'

describe('initChat', () => {
  // Only initialize once for all tests to avoid duplicate registrations
  beforeAll(() => {
    // Set up default mock implementations
    mockGetChatByUid.mockResolvedValue({
      uid: 'chat-123',
      provider: 'openai',
      model: 'gpt-4',
      prompts: ['Be helpful'],
      contextSettings: {
        maxMessages: 10,
        timeWindowHours: null,
        autoScrollToBottomOnSend: true,
      },
      llmSettings: {},
      workspace: [],
    })

    mockCreateUserMessage.mockResolvedValue({
      uid: 'msg-user-123',
      chatUid: 'chat-123',
      role: 'user',
      content: 'Hello',
      kind: 'message',
      status: 'done',
      seq: 1,
      createdAt: Date.now(),
    })

    mockGetLatestMessages.mockResolvedValue([])
    mockRunBuiltinSubAgent.mockResolvedValue({
      title: '优化后的标题',
      source: 'llm',
    })

    mockProviderStore.list.mockReturnValue([
      {
        name: 'openai',
        apiType: 'openai',
        apiKey: 'sk-test',
        baseUrl: 'https://api.openai.com/v1',
        temperature: 0.4,
        maxTokens: 1500,
      },
    ])
    // Initialize chat once
    initChat()
  })

  // Helper to get the registered handlers
  function getHandlers() {
    const messageHandler = mockOnCommand.mock.calls.find(
      call => call[0] === 'chat.message',
    )?.[1] as ((payload: MessagePayload) => Promise<void>) | undefined

    const abortHandler = mockOnCommand.mock.calls.find(
      call => call[0] === 'chat.abort',
    )?.[1] as ((payload: AbortPayload) => Promise<void>) | undefined

    return { messageHandler, abortHandler }
  }

  describe('chat.message command handler', () => {
    it('should process user message and start session', async () => {
      const { messageHandler } = getHandlers()

      if (!messageHandler)
        return

      const payload: MessagePayload = {
        chatId: 'chat-123',
        content: 'Hello AI',
        replyTo: null,
      }

      await messageHandler(payload)

      // Verify flow
      expect(mockGetChatByUid).toHaveBeenCalledWith('chat-123')
      expect(mockCreateUserMessage).toHaveBeenCalledWith('chat-123', 'Hello AI')
      expect(mockUpdateLastMessagePreview).toHaveBeenCalledWith('chat-123', 'Hello AI')
      expect(mockProviderStore.list).toHaveBeenCalled()
      expect(mockSessionOrchestrator.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          chatUid: 'chat-123',
          modelConfig: {
            provider: 'openai',
            model: 'gpt-4',
            apiKey: 'sk-test',
            baseURL: 'https://api.openai.com/v1',
            temperature: 0.4,
            maxTokens: 1500,
          },
        }),
      )
    })

    it('should allow Ollama provider without api key', async () => {
      const { messageHandler } = getHandlers()

      if (!messageHandler)
        return

      mockGetChatByUid.mockResolvedValueOnce({
        uid: 'chat-ollama',
        title: 'Ollama test',
        provider: 'ollama-local',
        model: 'qwen3:32b',
        prompts: [],
        contextSettings: {
          maxMessages: 10,
          timeWindowHours: null,
          autoScrollToBottomOnSend: true,
        },
        llmSettings: {},
        workspace: [],
      })

      mockProviderStore.list.mockReturnValueOnce([
        {
          name: 'ollama-local',
          apiType: 'ollama',
          apiKey: '',
          baseUrl: 'http://localhost:11434/v1',
          temperature: 0.5,
          maxTokens: 8192,
        },
      ])

      await messageHandler({
        chatId: 'chat-ollama',
        content: 'hello ollama',
        replyTo: null,
      })

      expect(mockSessionOrchestrator.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          modelConfig: {
            provider: 'ollama',
            model: 'qwen3:32b',
            apiKey: '',
            baseURL: 'http://localhost:11434/v1',
            temperature: 0.5,
            maxTokens: 8192,
          },
        }),
      )
    })

    it('should prefer chat llm settings over provider defaults', async () => {
      const { messageHandler } = getHandlers()

      if (!messageHandler)
        return

      mockGetChatByUid.mockResolvedValueOnce({
        uid: 'chat-override',
        title: 'Override test',
        provider: 'openai',
        model: 'gpt-4',
        prompts: [],
        contextSettings: {
          maxMessages: 10,
          timeWindowHours: null,
          autoScrollToBottomOnSend: true,
        },
        llmSettings: {
          temperature: 0.9,
          maxTokens: 3200,
        },
        workspace: [],
      })

      mockProviderStore.list.mockReturnValueOnce([
        {
          name: 'openai',
          apiType: 'openai',
          apiKey: 'sk-test',
          baseUrl: 'https://api.openai.com/v1',
          temperature: 0.2,
          maxTokens: 1000,
        },
      ])

      await messageHandler({
        chatId: 'chat-override',
        content: 'override config',
        replyTo: null,
      })

      expect(mockSessionOrchestrator.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          modelConfig: {
            provider: 'openai',
            model: 'gpt-4',
            apiKey: 'sk-test',
            baseURL: 'https://api.openai.com/v1',
            temperature: 0.9,
            maxTokens: 3200,
          },
        }),
      )
    })

    it('should emit message.created event', async () => {
      const { messageHandler } = getHandlers()

      if (!messageHandler)
        return

      const payload: MessagePayload = {
        chatId: 'chat-456',
        content: 'Test message',
        replyTo: null,
      }

      await messageHandler(payload)

      expect(mockUpdate).toHaveBeenCalledWith('message.created', {
        chatUid: 'chat-456',
        message: expect.any(Object),
      })
    })

    it('should emit chat.updated event with preview', async () => {
      const { messageHandler } = getHandlers()

      if (!messageHandler)
        return

      const payload: MessagePayload = {
        chatId: 'chat-789',
        content: 'Preview test',
        replyTo: null,
      }

      await messageHandler(payload)

      expect(mockUpdate).toHaveBeenCalledWith('chat.updated', {
        chatUid: 'chat-789',
        updates: { lastMessagePreview: 'Preview test' },
      })
    })

    it('should auto generate title after message when current title is fallback title', async () => {
      mockGetChatByUid
        .mockResolvedValueOnce({
          uid: 'chat-title',
          title: '请帮我分析一下 React useEffect 的依赖',
          provider: 'openai',
          model: 'gpt-4',
          prompts: [],
          contextSettings: {
            maxMessages: 10,
            timeWindowHours: null,
            autoScrollToBottomOnSend: true,
          },
          workspace: [],
        })
        .mockResolvedValueOnce({
          uid: 'chat-title',
          title: '请帮我分析一下 React useEffect 的依赖',
          provider: 'openai',
          model: 'gpt-4',
          prompts: [],
          contextSettings: {
            maxMessages: 10,
            timeWindowHours: null,
            autoScrollToBottomOnSend: true,
          },
          workspace: [],
        })

      const { messageHandler } = getHandlers()

      if (!messageHandler)
        return

      await messageHandler({
        chatId: 'chat-title',
        content: '请帮我分析一下 React useEffect 的依赖和闭包陷阱',
        replyTo: null,
      })

      await Promise.resolve()

      expect(mockRunBuiltinSubAgent).toHaveBeenCalledWith('title-from-question', expect.objectContaining({
        question: '请帮我分析一下 React useEffect 的依赖和闭包陷阱',
      }))
      expect(mockUpdateChatTitle).toHaveBeenCalledWith('chat-title', '优化后的标题')
      expect(mockUpdate).toHaveBeenCalledWith('chat.updated', {
        chatUid: 'chat-title',
        updates: { title: '优化后的标题' },
      })
    })

    it('should not auto generate title again after the first title is set', async () => {
      mockGetChatByUid
        .mockResolvedValueOnce({
          uid: 'chat-title-existing',
          title: '已存在标题',
          provider: 'openai',
          model: 'gpt-4',
          prompts: [],
          contextSettings: {
            maxMessages: 10,
            timeWindowHours: null,
            autoScrollToBottomOnSend: true,
          },
          workspace: [],
        })
        .mockResolvedValueOnce({
          uid: 'chat-title-existing',
          title: '已存在标题',
          provider: 'openai',
          model: 'gpt-4',
          prompts: [],
          contextSettings: {
            maxMessages: 10,
            timeWindowHours: null,
            autoScrollToBottomOnSend: true,
          },
          workspace: [],
        })

      const { messageHandler } = getHandlers()

      if (!messageHandler)
        return

      await messageHandler({
        chatId: 'chat-title-existing',
        content: '继续补充更多上下文',
        replyTo: null,
      })

      await Promise.resolve()

      expect(mockRunBuiltinSubAgent).not.toHaveBeenCalled()
      expect(mockUpdateChatTitle).not.toHaveBeenCalled()
    })

    it('should handle chat not found', async () => {
      mockGetChatByUid.mockResolvedValue(null)

      const { messageHandler } = getHandlers()

      if (!messageHandler)
        return

      const payload: MessagePayload = {
        chatId: 'non-existent',
        content: 'Test',
        replyTo: null,
      }

      await messageHandler(payload)

      // Should not start session if chat not found
      expect(mockSessionOrchestrator.startSession).not.toHaveBeenCalled()
    })

    it('should handle provider not found', async () => {
      mockGetChatByUid.mockResolvedValue({
        uid: 'chat-no-provider',
        provider: 'unknown-provider',
        model: 'unknown-model',
      })

      mockProviderStore.list.mockReturnValue([])

      const { messageHandler } = getHandlers()

      if (!messageHandler)
        return

      const payload: MessagePayload = {
        chatId: 'chat-no-provider',
        content: 'Test',
        replyTo: null,
      }

      await messageHandler(payload)

      // Should not start session if provider not found
      expect(mockSessionOrchestrator.startSession).not.toHaveBeenCalled()
    })

    it('should apply context time window filter', async () => {
      const now = Date.now()
      const oldMessage = {
        role: 'user' as const,
        content: 'Old message',
        kind: 'message' as const,
        status: 'done' as const,
        seq: 1,
        createdAt: now - 25 * 60 * 60 * 1000, // 25 hours ago
      }

      const recentMessage = {
        role: 'assistant' as const,
        content: 'Recent message',
        kind: 'message' as const,
        status: 'done' as const,
        seq: 2,
        createdAt: now - 1 * 60 * 60 * 1000, // 1 hour ago
      }

      mockGetChatByUid.mockResolvedValue({
        uid: 'chat-time-window',
        provider: 'openai',
        model: 'gpt-4',
        contextSettings: {
          maxMessages: 10,
          timeWindowHours: 24,
        },
      })

      mockGetLatestMessages.mockResolvedValue([oldMessage, recentMessage])

      const { messageHandler } = getHandlers()

      if (!messageHandler)
        return

      const payload: MessagePayload = {
        chatId: 'chat-time-window',
        content: 'Test',
        replyTo: null,
      }

      await messageHandler(payload)

      const startCall = mockSessionOrchestrator.startSession.mock.calls[0] as unknown as [{ contextMessages?: TestContextMessage[] }] | undefined

      if (!startCall)
        return

      const contextMessages = startCall?.[0]?.contextMessages

      // Should only include recent message within time window
      expect(Array.isArray(contextMessages)).toBe(true)
      expect(contextMessages).toHaveLength(1)
      expect(contextMessages?.[0].content).toBe('Recent message')
    })

    it('should apply max messages limit', async () => {
      const messages = Array.from({ length: 20 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `Message ${i}`,
        kind: 'message' as const,
        status: 'done' as const,
        seq: i + 1,
        createdAt: Date.now() - i * 1000,
      }))

      mockGetChatByUid.mockResolvedValue({
        uid: 'chat-max-messages',
        provider: 'openai',
        model: 'gpt-4',
        contextSettings: {
          maxMessages: 5,
          timeWindowHours: null,
        },
      })

      mockGetLatestMessages.mockResolvedValue(messages)

      const { messageHandler } = getHandlers()

      if (!messageHandler)
        return

      const payload: MessagePayload = {
        chatId: 'chat-max-messages',
        content: 'Test',
        replyTo: null,
      }

      await messageHandler(payload)

      expect(mockGetLatestMessages).toHaveBeenCalledWith('chat-max-messages', 5)
    })
  })

  describe('chat.abort command handler', () => {
    it('should abort specific session by requestId', async () => {
      const { abortHandler } = getHandlers()

      if (!abortHandler)
        return

      mockSessionOrchestrator.abortSession.mockReturnValue(true)

      const payload: AbortPayload = {
        requestId: 'req-to-abort',
        chatId: null,
      }

      await abortHandler(payload)

      expect(mockSessionOrchestrator.abortSession).toHaveBeenCalledWith('req-to-abort')
    })

    it('should abort all sessions for chat by chatId', async () => {
      const { abortHandler } = getHandlers()

      if (!abortHandler)
        return

      mockSessionOrchestrator.abortChatSessions.mockReturnValue(3)

      const payload: AbortPayload = {
        requestId: null,
        chatId: 'chat-to-abort',
      }

      await abortHandler(payload)

      expect(mockSessionOrchestrator.abortChatSessions).toHaveBeenCalledWith('chat-to-abort')
    })

    it('should handle non-existent session gracefully', async () => {
      const { abortHandler } = getHandlers()

      if (!abortHandler)
        return

      mockSessionOrchestrator.abortSession.mockReturnValue(false)

      const payload: AbortPayload = {
        requestId: 'non-existent',
        chatId: null,
      }

      // Should not throw
      await expect(abortHandler(payload)).resolves.toBeUndefined()
    })
  })
})
