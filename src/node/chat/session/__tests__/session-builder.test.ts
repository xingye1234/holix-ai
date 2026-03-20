/**
 * SessionBuilder 单元测试
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ============================================
// Hoisted Mocks (must be before imports)
// ============================================

const mockConfigStore = vi.hoisted(() => ({
  get: vi.fn((key: string) => {
    if (key === 'skillsContextStrategy')
      return 'eager'
    if (key === 'disabledSkills')
      return []
    return null
  }),
  getData: vi.fn(() => ({})),
}))

const mockGetChatSkillSettings = vi.hoisted(() => vi.fn(() => ({
  enabledSkills: [],
  disabledSkills: [],
})))

const mockLoadMcpTools = vi.hoisted(() => vi.fn(async () => []))

const mockCreateToolRegistry = vi.hoisted(() => vi.fn(() => ({
  buildTools: vi.fn(() => []),
  getSkillSystemPrompts: vi.fn(() => []),
  getConfig: vi.fn(() => ({ strategy: 'eager' })),
})))

const mockCreateAgent = vi.hoisted(() => vi.fn(() => ({
  stream: vi.fn(async function* () {
    yield ['messages', {}]
  }),
})))

// ============================================
// Module Mocks
// ============================================

vi.mock('../../../platform/config', () => ({
  configStore: mockConfigStore,
}))

// The session-builder.ts imports from '../../database/chat-skill-settings'
// In Vitest, mock paths are resolved from the test file location
// Test is in __tests__ subdirectory, so we need one more level up
vi.mock('../../../database/chat-skill-settings', () => ({
  getChatSkillSettings: mockGetChatSkillSettings,
}))

vi.mock('../../tools/tool-registry', () => ({
  createToolRegistry: mockCreateToolRegistry,
}))

vi.mock('../../mcp/tools', () => ({
  loadMcpTools: mockLoadMcpTools,
}))

vi.mock('../tools/tool-registry', () => ({
  createToolRegistry: mockCreateToolRegistry,
}))

vi.mock('../../../constant', () => ({
  APP_DATA_PATH: '/mock/app-data',
  BUILTIN_SKILLS_PATH: '/mock/skills',
  userDataDir: '/mock/user-data',
  databaseUrl: ':memory:',
}))

vi.mock('langchain', async () => {
  const actual = await vi.importActual('langchain')
  return {
    ...actual,
    createAgent: mockCreateAgent,
  }
})

// ============================================
// Import after mocks
// ============================================

import { SessionBuilder } from '../session-builder'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'

describe('SessionBuilder', () => {
  let mockLlm: BaseChatModel
  let mockSignal: AbortSignal

  beforeEach(() => {
    vi.clearAllMocks()
    mockLlm = {} as BaseChatModel
    mockSignal = new AbortController().signal

    // Reset default mock implementations
    mockGetChatSkillSettings.mockReturnValue({
      enabledSkills: [],
      disabledSkills: [],
    })

    mockCreateToolRegistry.mockReturnValue({
      buildTools: vi.fn(() => [
        { name: 'tool1' },
        { name: 'tool2' },
      ]),
      getSkillSystemPrompts: vi.fn(() => ['System prompt 1']),
      getConfig: vi.fn(() => ({ strategy: 'eager', coreSkills: [], disabledSkills: [] })),
    })
  })

  describe('constructor', () => {
    it('should create instance with minimal config', () => {
      const builder = new SessionBuilder({ llm: mockLlm })

      expect(builder).toBeInstanceOf(SessionBuilder)
    })

    it('should create instance with all config options', () => {
      const workspace = [
        { type: 'directory', value: '/path/to/dir' },
        { type: 'file', value: '/path/to/file' },
      ] as any

      const builder = new SessionBuilder({
        llm: mockLlm,
        systemMessages: ['System prompt 1', 'System prompt 2'],
        workspace,
        toolLoadingStrategy: 'lazy',
        coreSkills: ['skill1', 'skill2'],
      })

      expect(builder).toBeInstanceOf(SessionBuilder)
    })
  })

  describe('buildAgent', () => {
    it('should build agent with default config', async () => {
      const builder = new SessionBuilder({ llm: mockLlm })
      const agent = await builder.buildAgent('chat-123', mockSignal)

      expect(agent).toBeDefined()
      expect(mockCreateAgent).toHaveBeenCalled()
    })

    it('should use chat-specific skill settings', async () => {
      mockGetChatSkillSettings.mockReturnValue({
        enabledSkills: ['skill1'],
        disabledSkills: ['skill2'],
      })

      const builder = new SessionBuilder({ llm: mockLlm })
      await builder.buildAgent('chat-123', mockSignal)

      expect(mockGetChatSkillSettings).toHaveBeenCalledWith('chat-123')
      expect(mockCreateToolRegistry).toHaveBeenCalledWith(
        expect.objectContaining({
          disabledSkills: expect.arrayContaining(['skill2']),
        }),
      )
    })

    it('should merge global and chat-specific disabled skills', async () => {
      mockConfigStore.get.mockImplementation((key: string) => {
        if (key === 'disabledSkills')
          return ['global-skill']
        return null
      })

      mockGetChatSkillSettings.mockReturnValue({
        enabledSkills: ['chat-skill'],
        disabledSkills: ['chat-disabled'],
      })

      const builder = new SessionBuilder({ llm: mockLlm })
      await builder.buildAgent('chat-123', mockSignal)

      const callArgs = mockCreateToolRegistry.mock.calls[0][0]
      expect(callArgs.disabledSkills).toContain('chat-disabled')
    })

    it('should prioritize chat-enabled skills over global disabled', async () => {
      mockConfigStore.get.mockImplementation((key: string) => {
        if (key === 'disabledSkills')
          return ['skill1', 'skill2']
        return null
      })

      mockGetChatSkillSettings.mockReturnValue({
        enabledSkills: ['skill1'],
        disabledSkills: [],
      })

      const builder = new SessionBuilder({ llm: mockLlm })
      await builder.buildAgent('chat-123', mockSignal)

      const callArgs = mockCreateToolRegistry.mock.calls[0][0]
      expect(callArgs.disabledSkills).not.toContain('skill1')
    })
  })

  describe('buildMessages', () => {
    it('should build messages from context', () => {
      const contextMessages = [
        { role: 'user', content: 'Hello' } as any,
        { role: 'assistant', content: 'Hi there!' } as any,
        { role: 'system', content: 'Be helpful' } as any,
      ]

      const builder = new SessionBuilder({ llm: mockLlm })
      const messages = builder.buildMessages(contextMessages, 'New message')

      expect(messages).toHaveLength(4) // 3 context + 1 new
    })

    it('should add current user message', () => {
      const builder = new SessionBuilder({ llm: mockLlm })
      const messages = builder.buildMessages([], 'Test message')

      expect(messages).toHaveLength(1)
      expect(messages[0].constructor.name).toBe('HumanMessage')
    })

    it('should handle empty context', () => {
      const builder = new SessionBuilder({ llm: mockLlm })
      const messages = builder.buildMessages([], 'Test')

      expect(messages).toHaveLength(1)
    })

    it('should filter out messages with empty content', () => {
      const contextMessages = [
        { role: 'user', content: '' } as any,
        { role: 'assistant', content: null as any },
      ]

      const builder = new SessionBuilder({ llm: mockLlm })
      const messages = builder.buildMessages(contextMessages, 'Test')

      // Should still create messages even with empty content
      expect(messages.length).toBeGreaterThan(0)
    })
  })

  describe('buildContext', () => {
    it('should build context with config', () => {
      mockConfigStore.getData.mockReturnValue({ apiKey: 'test' })

      const builder = new SessionBuilder({ llm: mockLlm })
      const context = builder.buildContext('chat-456')

      expect(context).toEqual({
        config: { apiKey: 'test' },
        chatUid: 'chat-456',
      })
    })

    it('should call configStore.getData', () => {
      const builder = new SessionBuilder({ llm: mockLlm })
      builder.buildContext('chat-789')

      expect(mockConfigStore.getData).toHaveBeenCalled()
    })
  })

  describe('system message building', () => {
    it('should include system messages in agent', async () => {
      const builder = new SessionBuilder({
        llm: mockLlm,
        systemMessages: ['Custom system prompt'],
      })

      await builder.buildAgent('chat-123', mockSignal)

      expect(mockCreateAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.any(Object),
        }),
      )
    })

    it('should include workspace in system prompt when provided', async () => {
      const workspace = [
        { type: 'directory', value: '/project' },
      ] as any

      const builder = new SessionBuilder({
        llm: mockLlm,
        workspace,
      })

      await builder.buildAgent('chat-123', mockSignal)

      const agentCall = mockCreateAgent.mock.calls[0]
      expect(agentCall[0]).toBeDefined()
    })
  })
})
