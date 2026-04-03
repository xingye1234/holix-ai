/**
 * ChatSession 单元测试
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ============================================
// Hoisted Mocks (must be before imports)
// ============================================

const mockMessagePersister = vi.hoisted(() => ({
  getNextSeq: vi.fn(async () => 1),
  createMessage: vi.fn(async (data: any) => ({
    uid: `msg-${Date.now()}`,
    ...data,
  })),
  updateStatus: vi.fn(async () => {}),
  updateContentAndDraft: vi.fn(async () => {}),
  finalizeMessage: vi.fn(async () => {}),
  markAsAborted: vi.fn(async () => {}),
  markAsError: vi.fn(async () => {}),
}))

const mockChatEventEmitter = vi.hoisted(() => ({
  emitMessageCreated: vi.fn(),
  emitMessageUpdated: vi.fn(),
}))

const mockConfigStore = vi.hoisted(() => ({
  get: vi.fn((key: string) => {
    if (key === 'skillsContextStrategy')
      return 'eager'
    return null
  }),
}))

const mockToolCallTracker = vi.hoisted(() => ({
  buildToolCallTraces: vi.fn(() => []),
}))

// ============================================
// Module Mocks
// ============================================

vi.mock('../../message/message-persister', () => ({
  messagePersister: mockMessagePersister,
}))

vi.mock('../../events/chat-event-emitter', () => ({
  chatEventEmitter: mockChatEventEmitter,
}))

vi.mock('../../../platform/config', () => ({
  configStore: mockConfigStore,
}))

vi.mock('../../../constant', () => ({
  APP_DATA_PATH: '/mock/app-data',
  BUILTIN_SKILLS_PATH: '/mock/skills',
  userDataDir: '/mock/user-data',
  databaseUrl: ':memory:',
}))

vi.mock('../tools/tool-call-tracker', () => ({
  toolCallTracker: mockToolCallTracker,
}))

const mockSessionBuilderConstructor = vi.hoisted(() => vi.fn())

vi.mock('../session-builder', () => ({
  SessionBuilder: class SessionBuilder {
    constructor() {
      mockSessionBuilderConstructor()
    }

    buildAgent = vi.fn(async () => ({
      async* stream() {
        yield ['messages', {
          getType: () => 'ai',
          content: 'Hello',
          tool_call_chunks: null,
        }]
        yield ['updates', { agent: { messages: [] } }]
      },
    }))

    buildMessages = vi.fn(() => [])
    buildContext = vi.fn(() => ({}))
  },
}))

// ============================================
// Import after mocks
// ============================================

import { ChatSession } from '../chat-session'

describe('ChatSession', () => {
  let sessionConfig: any
  const modelConfig = {
    provider: 'openai',
    model: 'gpt-4.1',
    apiKey: 'sk-test',
    baseURL: 'https://api.openai.com/v1',
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset default mock implementations
    mockMessagePersister.getNextSeq.mockResolvedValue(1)
    mockMessagePersister.createMessage.mockResolvedValue({
      uid: 'msg-assistant-123',
      chatUid: 'chat-123',
      seq: 1,
      role: 'assistant',
      kind: 'message',
      content: '',
      status: 'pending',
      requestId: 'req-123',
      streamId: 'stream-123',
      createdAt: Date.now(),
    })

    sessionConfig = {
      chatUid: 'chat-123',
      requestId: 'req-123',
      streamId: 'stream-123',
      assistantMessageUid: 'msg-assistant-123',
      modelConfig,
      systemMessages: [{ content: 'System prompt' }],
      workspace: [],
    }
  })

  describe('constructor', () => {
    it('should create session with config', () => {
      const session = new ChatSession(sessionConfig)

      expect(session.getStatus()).toBe('running')
      expect(session.getConfig()).toBe(sessionConfig)
    })

    it('should initialize abort controller', () => {
      const session = new ChatSession(sessionConfig)
      const config = session.getConfig()

      expect(config).toBeDefined()
    })
  })

  describe('create', () => {
    it('should create new session with message', async () => {
      const session = await ChatSession.create({
        chatUid: 'chat-456',
        modelConfig,
        userMessageContent: 'Hello',
        contextMessages: [],
        systemMessages: ['Be helpful'],
      })

      expect(session).toBeInstanceOf(ChatSession)
      expect(mockMessagePersister.createMessage).toHaveBeenCalled()
      expect(mockChatEventEmitter.emitMessageCreated).toHaveBeenCalled()
    })

    it('should generate unique IDs for session', async () => {
      const session1 = await ChatSession.create({
        chatUid: 'chat-789',
        modelConfig,
        userMessageContent: 'Test 1',
      })

      const session2 = await ChatSession.create({
        chatUid: 'chat-789',
        modelConfig,
        userMessageContent: 'Test 2',
      })

      const config1 = session1.getConfig()
      const config2 = session2.getConfig()

      expect(config1.requestId).not.toBe(config2.requestId)
      expect(config1.streamId).not.toBe(config2.streamId)
    })

    it('should use next sequence number', async () => {
      mockMessagePersister.getNextSeq.mockResolvedValue(5)

      await ChatSession.create({
        chatUid: 'chat-999',
        modelConfig,
        userMessageContent: 'Test',
      })

      expect(mockMessagePersister.getNextSeq).toHaveBeenCalledWith('chat-999')
    })
  })

  describe('getStatus', () => {
    it('should return initial status as running', () => {
      const session = new ChatSession(sessionConfig)

      expect(session.getStatus()).toBe('running')
    })
  })

  describe('getConfig', () => {
    it('should return session config', () => {
      const session = new ChatSession(sessionConfig)
      const config = session.getConfig()

      expect(config.chatUid).toBe('chat-123')
      expect(config.requestId).toBe('req-123')
    })
  })

  describe('abort', () => {
    it('should change status to aborted', () => {
      const session = new ChatSession(sessionConfig)

      expect(session.getStatus()).toBe('running')

      session.abort()

      expect(session.getStatus()).toBe('aborted')
    })

    it('should handle multiple abort calls', () => {
      const session = new ChatSession(sessionConfig)

      session.abort()
      session.abort() // Should not throw

      expect(session.getStatus()).toBe('aborted')
    })
  })

  describe('run', () => {
    it('should process stream and update message', async () => {
      const session = new ChatSession(sessionConfig)

      // Mock message persister methods
      mockMessagePersister.updateStatus.mockResolvedValue(undefined)
      mockMessagePersister.updateContentAndDraft.mockResolvedValue(undefined)
      mockMessagePersister.finalizeMessage.mockResolvedValue(undefined)

      await session.run('Hello', [])

      expect(mockMessagePersister.updateStatus).toHaveBeenCalled()
    }, 10000)

    it('should update status to streaming on start', async () => {
      const session = new ChatSession(sessionConfig)

      await session.run('Test', [])

      expect(mockMessagePersister.updateStatus).toHaveBeenCalledWith(
        sessionConfig.assistantMessageUid,
        'streaming',
      )
    }, 10000)

    it('should handle abort during run', async () => {
      const session = new ChatSession(sessionConfig)

      // Abort immediately
      session.abort()

      await session.run('Test', [])

      expect(session.getStatus()).toBe('aborted')
    }, 10000)
  })

  describe('error handling', () => {
    it('should handle errors during run', async () => {
      const session = new ChatSession(sessionConfig)

      // Mock an error
      mockMessagePersister.updateStatus.mockRejectedValue(new Error('Database error'))

      // Should not throw, but handle error internally
      await expect(session.run('Test', [])).resolves.toBeUndefined()

      expect(session.getStatus()).toBe('error')
    }, 10000)
  })
})
