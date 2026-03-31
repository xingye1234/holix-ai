/**
 * SessionBuilder 单元测试
 */

import type { LoadedSkill } from '../../skills/type'
import type { SessionModelConfig } from '../session-state'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockConfigStore = vi.hoisted(() => ({
  get: vi.fn((key: string) => {
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
const mockInitChatModel = vi.hoisted(() => vi.fn(async () => ({ kind: 'mock-model' })))
const mockCreateDeepAgent = vi.hoisted(() => vi.fn((params: any) => ({ params, stream: vi.fn() })))
const mockFilesystemBackend = vi.hoisted(() => vi.fn())
const mockListSkills = vi.hoisted(() => vi.fn(() => []))

const tempRoot = vi.hoisted(() => '/tmp/holix-ai-session-builder-tests')

vi.mock('../../../platform/config', () => ({
  configStore: mockConfigStore,
}))

vi.mock('../../../database/chat-skill-settings', () => ({
  getChatSkillSettings: mockGetChatSkillSettings,
}))

vi.mock('../../mcp/tools', () => ({
  loadMcpTools: mockLoadMcpTools,
}))

vi.mock('../../skills', () => ({
  skillManager: {
    listSkills: mockListSkills,
  },
}))

vi.mock('../../../constant', () => ({
  APP_DATA_PATH: tempRoot,
}))

vi.mock('../../../platform/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('langchain/chat_models/universal', () => ({
  initChatModel: mockInitChatModel,
}))

vi.mock('deepagents', () => ({
  createDeepAgent: mockCreateDeepAgent,
  FilesystemBackend: class FilesystemBackend {
    constructor(config: any) {
      mockFilesystemBackend(config)
      return {
        kind: 'filesystem-backend',
        config,
      }
    }
  },
}))

vi.mock('../../tools/chat', () => ({
  chatTimeSearchTool: { name: 'chat_time_search' },
  chatKeywordSearchTool: { name: 'chat_keyword_search' },
}))

vi.mock('../../tools/context7', () => ({
  context7Tool: { name: 'context7_search' },
}))

vi.mock('../../tools/system', () => ({
  systemPlatformTool: { name: 'system_platform' },
  systemEnvTool: { name: 'system_env' },
  systemTimezoneTool: { name: 'system_timezone' },
  systemTimeTool: { name: 'system_time' },
}))

import { SessionBuilder } from '../session-builder'

function createModelConfig(overrides: Partial<SessionModelConfig> = {}): SessionModelConfig {
  return {
    provider: 'openai',
    model: 'gpt-4.1',
    apiKey: 'sk-test',
    baseURL: 'https://api.openai.com/v1',
    ...overrides,
  }
}

function createLoadedSkill(options: {
  name: string
  description?: string
  prompt?: string
  toolNames?: string[]
  withSkillMarkdown?: boolean
}): LoadedSkill {
  const skillDir = mkdtempSync(join(tempRoot, `${options.name}-`))
  mkdirSync(skillDir, { recursive: true })
  writeFileSync(join(skillDir, 'README.md'), `# ${options.name}\n`, 'utf-8')

  if (options.withSkillMarkdown) {
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      [
        '---',
        `name: ${options.name}`,
        `description: ${JSON.stringify(options.description || `${options.name} description`)}`,
        '---',
        '',
        `# ${options.name}`,
        '',
        options.prompt || `${options.name} prompt`,
        '',
      ].join('\n'),
      'utf-8',
    )
  }

  return {
    name: options.name,
    version: '1.0.0',
    description: options.description || `${options.name} description`,
    prompt: options.prompt,
    dir: skillDir,
    tools: (options.toolNames || []).map(name => ({ name }) as any),
  }
}

describe('SessionBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rmSync(tempRoot, { recursive: true, force: true })
    mkdirSync(tempRoot, { recursive: true })

    mockGetChatSkillSettings.mockReturnValue({
      enabledSkills: [],
      disabledSkills: [],
    })
    mockConfigStore.get.mockImplementation((key: string) => {
      if (key === 'disabledSkills')
        return []
      return null
    })
    mockConfigStore.getData.mockReturnValue({})
    mockLoadMcpTools.mockResolvedValue([])
    mockListSkills.mockReturnValue([])
    mockInitChatModel.mockResolvedValue({ kind: 'mock-model' })
    mockCreateDeepAgent.mockImplementation((params: any) => ({ params, stream: vi.fn() }))
    mockFilesystemBackend.mockImplementation(() => {})
  })

  describe('constructor', () => {
    it('should create instance with minimal config', () => {
      const builder = new SessionBuilder({ modelConfig: createModelConfig() })

      expect(builder).toBeInstanceOf(SessionBuilder)
    })

    it('should create instance with all config options', () => {
      const builder = new SessionBuilder({
        modelConfig: createModelConfig(),
        systemMessages: ['System prompt 1', 'System prompt 2'],
        workspace: [
          { type: 'directory', value: '/path/to/dir' },
          { type: 'file', value: '/path/to/file.ts' },
        ] as any,
        toolLoadingStrategy: 'smart',
        coreSkills: ['skill1'],
      })

      expect(builder).toBeInstanceOf(SessionBuilder)
    })
  })

  describe('buildAgent', () => {
    it.each([
      {
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
        expectedModelIdentifier: 'anthropic:claude-sonnet-4-5',
        options: {
          apiKey: 'sk-anthropic',
          anthropicApiUrl: 'https://anthropic.example.com',
          streaming: true,
        },
      },
      {
        provider: 'gemini',
        model: 'gemini-2.5-pro',
        expectedModelIdentifier: 'google-genai:gemini-2.5-pro',
        options: {
          apiKey: 'sk-google',
          baseUrl: 'https://google.example.com',
          streaming: true,
        },
      },
      {
        provider: 'ollama',
        model: 'qwen3:32b',
        expectedModelIdentifier: 'ollama:qwen3:32b',
        options: {
          baseUrl: 'http://localhost:11434',
          streaming: true,
        },
      },
      {
        provider: 'openai',
        model: 'gpt-4.1',
        expectedModelIdentifier: 'openai:gpt-4.1',
        options: {
          apiKey: 'sk-openai',
          configuration: { baseURL: 'https://openai.example.com/v1' },
          streaming: true,
        },
      },
      {
        provider: 'deepseek',
        model: 'deepseek-chat',
        expectedModelIdentifier: 'openai:deepseek-chat',
        options: {
          apiKey: 'sk-deepseek',
          configuration: { baseURL: 'https://api.deepseek.com/v1' },
          streaming: true,
        },
      },
    ])('should build model for $provider provider', async ({ provider, model, expectedModelIdentifier, options }) => {
      const builder = new SessionBuilder({
        modelConfig: createModelConfig({
          provider,
          model,
          apiKey: options.apiKey,
          baseURL: provider === 'ollama' ? options.baseUrl : provider === 'anthropic' ? options.anthropicApiUrl : provider === 'gemini' ? options.baseUrl : options.configuration?.baseURL,
        }),
      })

      await builder.buildAgent('chat-provider')

      expect(mockInitChatModel).toHaveBeenCalledWith(expectedModelIdentifier, options)
      expect(mockCreateDeepAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.anything(),
        }),
      )
    })

    it('should create agent with backend rooted at workspace common path', async () => {
      const builder = new SessionBuilder({
        modelConfig: createModelConfig(),
        workspace: [
          { type: 'directory', value: '/repo/apps/web' },
          { type: 'file', value: '/repo/packages/ui/button.tsx' },
        ] as any,
      })

      await builder.buildAgent('chat-backend-root')

      expect(mockFilesystemBackend).toHaveBeenCalledWith({
        rootDir: '/repo',
      })
    })

    it('should merge global and chat-specific disabled skills while keeping chat-enabled skills active', async () => {
      const alphaSkill = createLoadedSkill({ name: 'alpha', toolNames: ['alpha_tool'] })
      const betaSkill = createLoadedSkill({ name: 'beta', toolNames: ['beta_tool'] })
      const gammaSkill = createLoadedSkill({ name: 'gamma', toolNames: ['gamma_tool'] })
      mockListSkills.mockReturnValue([alphaSkill, betaSkill, gammaSkill])
      mockConfigStore.get.mockImplementation((key: string) => {
        if (key === 'disabledSkills')
          return ['alpha']
        return null
      })
      mockGetChatSkillSettings.mockReturnValue({
        enabledSkills: ['alpha'],
        disabledSkills: ['beta'],
      })

      const builder = new SessionBuilder({
        modelConfig: createModelConfig(),
      })

      await builder.buildAgent('chat-skills-merge')

      const generatedSkillsRoot = join(tempRoot, 'deepagents', 'sessions', 'chat-skills-merge', 'skills')
      expect(readdirSync(generatedSkillsRoot).sort()).toEqual(['alpha', 'gamma'])
    })

    it('should materialize runtime skills and generate SKILL.md when missing', async () => {
      const customSkill = createLoadedSkill({
        name: 'custom_skill',
        description: 'Custom skill description',
        prompt: 'Follow the custom skill instructions.',
        toolNames: ['custom_tool'],
      })
      mockListSkills.mockReturnValue([customSkill])

      const builder = new SessionBuilder({
        modelConfig: createModelConfig(),
        toolLoadingStrategy: 'lazy',
      })

      await builder.buildAgent('chat-runtime-skills')

      const generatedSkillsRoot = join(tempRoot, 'deepagents', 'sessions', 'chat-runtime-skills', 'skills')
      const generatedSkillMd = readFileSync(join(generatedSkillsRoot, 'custom_skill', 'SKILL.md'), 'utf-8')

      expect(mockCreateDeepAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          skills: [generatedSkillsRoot],
          memory: undefined,
        }),
      )
      expect(generatedSkillMd).toContain('name: custom_skill')
      expect(generatedSkillMd).toContain('allowed-tools:')
      expect(generatedSkillMd).toContain('- custom_tool')
      expect(generatedSkillMd).toContain('Follow the custom skill instructions.')
    })

    it('should keep existing SKILL.md files when present', async () => {
      const documentedSkill = createLoadedSkill({
        name: 'documented_skill',
        description: 'Documented skill',
        prompt: 'Use the authored instructions.',
        withSkillMarkdown: true,
      })
      mockListSkills.mockReturnValue([documentedSkill])

      const builder = new SessionBuilder({
        modelConfig: createModelConfig(),
      })

      await builder.buildAgent('chat-existing-skill-md')

      const generatedSkillsRoot = join(tempRoot, 'deepagents', 'sessions', 'chat-existing-skill-md', 'skills')
      const generatedSkillMd = readFileSync(join(generatedSkillsRoot, 'documented_skill', 'SKILL.md'), 'utf-8')

      expect(generatedSkillMd).toContain('Use the authored instructions.')
      expect(generatedSkillMd).not.toContain('allowed-tools:')
    })

    it('should generate AGENTS.md for eager strategy with all enabled skills', async () => {
      const alphaSkill = createLoadedSkill({ name: 'alpha', prompt: 'Alpha instructions' })
      const betaSkill = createLoadedSkill({ name: 'beta', prompt: 'Beta instructions' })
      mockListSkills.mockReturnValue([alphaSkill, betaSkill])

      const builder = new SessionBuilder({
        modelConfig: createModelConfig(),
        toolLoadingStrategy: 'eager',
      })

      await builder.buildAgent('chat-eager-memory')

      const memoryPath = join(tempRoot, 'deepagents', 'sessions', 'chat-eager-memory', 'AGENTS.md')
      const memoryContent = readFileSync(memoryPath, 'utf-8')

      expect(mockCreateDeepAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          memory: [memoryPath],
        }),
      )
      expect(memoryContent).toContain('## alpha')
      expect(memoryContent).toContain('## beta')
    })

    it('should only preload core skills for smart strategy', async () => {
      const alphaSkill = createLoadedSkill({ name: 'alpha', prompt: 'Alpha instructions' })
      const betaSkill = createLoadedSkill({ name: 'beta', prompt: 'Beta instructions' })
      mockListSkills.mockReturnValue([alphaSkill, betaSkill])

      const builder = new SessionBuilder({
        modelConfig: createModelConfig(),
        toolLoadingStrategy: 'smart',
        coreSkills: ['beta'],
      })

      await builder.buildAgent('chat-smart-memory')

      const memoryPath = join(tempRoot, 'deepagents', 'sessions', 'chat-smart-memory', 'AGENTS.md')
      const memoryContent = readFileSync(memoryPath, 'utf-8')

      expect(memoryContent).not.toContain('## alpha')
      expect(memoryContent).toContain('## beta')
    })

    it('should compose tools from base tools, custom skills, mcp tools, and dedupe collisions', async () => {
      const fileSystemSkill = createLoadedSkill({
        name: 'file_system',
        toolNames: ['read_file', 'write_file'],
      })
      const customSkill = createLoadedSkill({
        name: 'custom_skill',
        toolNames: ['custom_tool', 'read_file'],
      })
      mockListSkills.mockReturnValue([fileSystemSkill, customSkill])
      mockLoadMcpTools.mockResolvedValue([
        { name: 'mcp_tool' } as any,
        { name: 'custom_tool' } as any,
      ])
      mockConfigStore.get.mockImplementation((key: string) => {
        if (key === 'disabledSkills')
          return []
        if (key === 'context7ApiKey')
          return 'ctx7-key'
        return null
      })

      const builder = new SessionBuilder({
        modelConfig: createModelConfig(),
      })

      await builder.buildAgent('chat-tools')

      const toolNames = mockCreateDeepAgent.mock.calls[0][0].tools.map((tool: { name: string }) => tool.name)

      expect(toolNames).toEqual([
        'system_platform',
        'system_env',
        'system_timezone',
        'system_time',
        'chat_time_search',
        'chat_keyword_search',
        'context7_search',
        'custom_tool',
        'mcp_tool',
      ])
    })
  })

  describe('buildMessages', () => {
    it('should build messages from context', () => {
      const contextMessages = [
        { role: 'user', content: 'Hello' } as any,
        { role: 'assistant', content: 'Hi there!' } as any,
        { role: 'system', content: 'Be helpful' } as any,
      ]

      const builder = new SessionBuilder({ modelConfig: createModelConfig() })
      const messages = builder.buildMessages(contextMessages, 'New message')

      expect(messages).toHaveLength(4)
      expect(messages[0].constructor.name).toBe('HumanMessage')
      expect(messages[1].constructor.name).toBe('AIMessage')
      expect(messages[2].constructor.name).toBe('SystemMessage')
      expect(messages[3].constructor.name).toBe('HumanMessage')
    })

    it('should handle empty content by normalizing to empty strings', () => {
      const builder = new SessionBuilder({ modelConfig: createModelConfig() })
      const messages = builder.buildMessages([
        { role: 'user', content: '' } as any,
        { role: 'assistant', content: null } as any,
      ], 'Test')

      expect(messages).toHaveLength(3)
    })
  })

  describe('buildContext', () => {
    it('should build context with config data and chat uid', () => {
      mockConfigStore.getData.mockReturnValue({ apiKey: 'test-key' })

      const builder = new SessionBuilder({ modelConfig: createModelConfig() })
      const context = builder.buildContext('chat-456')

      expect(context).toEqual({
        config: { apiKey: 'test-key' },
        chatUid: 'chat-456',
      })
      expect(mockConfigStore.getData).toHaveBeenCalled()
    })
  })

  describe('system prompt', () => {
    it('should include system messages and workspace guidance', async () => {
      const builder = new SessionBuilder({
        modelConfig: createModelConfig(),
        systemMessages: ['Custom system prompt'],
        workspace: [
          { type: 'directory', value: '/project' },
          { type: 'file', value: '/project/README.md' },
        ] as any,
      })

      await builder.buildAgent('chat-system-prompt')

      const createAgentParams = mockCreateDeepAgent.mock.calls[0][0]
      expect(createAgentParams.systemPrompt).toContain('Custom system prompt')
      expect(createAgentParams.systemPrompt).toContain('## Workspace')
      expect(createAgentParams.systemPrompt).toContain('/project')
      expect(createAgentParams.systemPrompt).toContain('/project/README.md')
    })
  })
})
