/**
 * ToolRegistry 单元测试
 * 测试 Skills 在新架构下只影响 prompts，不再直接注册 tools
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSkillManager = vi.hoisted(() => ({
  listSkills: vi.fn(() => [
    {
      name: 'core-skill-1',
      prompt: 'Core skill 1 prompt',
    },
    {
      name: 'core-skill-2',
      prompt: 'Core skill 2 prompt',
    },
    {
      name: 'optional-skill',
      prompt: 'Optional skill prompt',
    },
  ]),
}))

const mockConfigStore = vi.hoisted(() => ({
  get: vi.fn((key: string) => {
    if (key === 'context7ApiKey')
      return 'test-api-key'
    return null
  }),
  getData: vi.fn(() => ({})),
}))

vi.mock('../../../platform/config', () => ({
  configStore: mockConfigStore,
}))

vi.mock('../../../skills/manager', () => ({
  skillManager: mockSkillManager,
}))

vi.mock('../../../constant', () => ({
  APP_DATA_PATH: '/mock/app-data',
  BUILTIN_SKILLS_PATH: '/mock/skills',
  userDataDir: '/mock/user-data',
  databaseUrl: ':memory:',
}))

vi.mock('../chat', () => ({
  chatKeywordSearchTool: { name: 'chat_keyword_search' },
  chatTimeSearchTool: { name: 'chat_time_search' },
}))

vi.mock('../context7', () => ({
  context7Tool: { name: 'context7' },
}))

vi.mock('../system', () => ({
  systemEnvTool: { name: 'system_env' },
  systemPlatformTool: { name: 'system_platform' },
  systemTimeTool: { name: 'system_time' },
  systemTimezoneTool: { name: 'system_timezone' },
}))

import { ToolRegistry, createToolRegistry } from '../tool-registry'

describe('toolRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSkillManager.listSkills.mockReturnValue([
      {
        name: 'core-skill-1',
        prompt: 'Core skill 1 prompt',
      },
      {
        name: 'core-skill-2',
        prompt: 'Core skill 2 prompt',
      },
      {
        name: 'optional-skill',
        prompt: 'Optional skill prompt',
      },
    ])
  })

  describe('constructor and Factory', () => {
    it('should create instance with default config', () => {
      const registry = new ToolRegistry()
      const config = registry.getConfig()

      expect(config.enableContext7).toBe(true)
      expect(config.disabledSkills).toEqual([])
    })

    it('should create instance with custom config', () => {
      const registry = new ToolRegistry({
        enableContext7: false,
        disabledSkills: ['optional-skill'],
      })
      const config = registry.getConfig()

      expect(config.enableContext7).toBe(false)
      expect(config.disabledSkills).toEqual(['optional-skill'])
    })

    it('should create instance via factory function', () => {
      const registry = createToolRegistry({ enableContext7: false })
      const config = registry.getConfig()

      expect(config.enableContext7).toBe(false)
    })
  })

  describe('buildTools', () => {
    it('should build base tools plus context7 when available', () => {
      const registry = new ToolRegistry()
      const tools = registry.buildTools()

      expect(tools.map(tool => tool.name)).toEqual([
        'system_platform',
        'system_env',
        'system_timezone',
        'system_time',
        'chat_time_search',
        'chat_keyword_search',
        'context7',
      ])
    })

    it('should exclude context7 when disabled', () => {
      const registry = new ToolRegistry({ enableContext7: false })
      const tools = registry.buildTools()

      expect(tools.map(tool => tool.name)).toEqual([
        'system_platform',
        'system_env',
        'system_timezone',
        'system_time',
        'chat_time_search',
        'chat_keyword_search',
      ])
    })
  })

  describe('getSkillSystemPrompts', () => {
    it('should load prompts for all enabled skills', () => {
      const registry = new ToolRegistry()
      const prompts = registry.getSkillSystemPrompts()

      expect(prompts).toEqual([
        '[Skill: core-skill-1]\nCore skill 1 prompt',
        '[Skill: core-skill-2]\nCore skill 2 prompt',
        '[Skill: optional-skill]\nOptional skill prompt',
      ])
      expect(mockSkillManager.listSkills).toHaveBeenCalled()
    })

    it('should skip prompts for skills without prompt field', () => {
      mockSkillManager.listSkills.mockReturnValue([
        {
          name: 'no-prompt-skill',
          prompt: null,
        },
      ])

      const registry = new ToolRegistry()
      const prompts = registry.getSkillSystemPrompts()

      expect(prompts).toEqual([])
    })

    it('should respect disabled skills', () => {
      const registry = new ToolRegistry({
        disabledSkills: ['optional-skill'],
      })
      const prompts = registry.getSkillSystemPrompts()

      expect(prompts).toEqual([
        '[Skill: core-skill-1]\nCore skill 1 prompt',
        '[Skill: core-skill-2]\nCore skill 2 prompt',
      ])
    })
  })

  describe('updateConfig', () => {
    it('should update config values', () => {
      const registry = new ToolRegistry({
        enableContext7: true,
        disabledSkills: ['skill1'],
      })

      registry.updateConfig({ enableContext7: false })
      const config = registry.getConfig()

      expect(config.enableContext7).toBe(false)
      expect(config.disabledSkills).toEqual(['skill1'])
    })
  })
})
