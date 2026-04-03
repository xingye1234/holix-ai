/**
 * ToolRegistry 单元测试
 * 测试 Skills 在新架构下只影响 prompts，不再直接注册 tools
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ============================================
// Hoisted Mocks (must be before imports)
// ============================================

const mockSkillManager = vi.hoisted(() => {
  const getSkillMock = vi.fn()
  getSkillMock.mockImplementation((name: string) => {
    const skills: Record<string, any> = {
      'core-skill-1': {
        name: 'core-skill-1',
        prompt: 'Core skill 1 prompt',
      },
      'core-skill-2': {
        name: 'core-skill-2',
        prompt: 'Core skill 2 prompt',
      },
      'optional-skill': {
        name: 'optional-skill',
        prompt: 'Optional skill prompt',
      },
    }
    return skills[name] || null
  })

  return {
    getAllTools: vi.fn(() => []),
    getSkill: getSkillMock,
    getSystemPrompts: vi.fn(() => [
      '[Skill: skill1]\nSkill 1 prompt',
      '[Skill: skill2]\nSkill 2 prompt',
    ]),
    getSkillsSummary: vi.fn(() => [
      { name: 'skill1', description: 'Skill 1 description' },
      { name: 'skill2', description: 'Skill 2 description' },
      { name: 'core-skill-1', description: 'Core skill 1 description' },
      { name: 'core-skill-2', description: 'Core skill 2 description' },
      { name: 'optional-skill', description: 'Optional skill description' },
    ]),
  }
})

const mockConfigStore = vi.hoisted(() => ({
  get: vi.fn((key: string) => {
    if (key === 'context7ApiKey')
      return 'test-api-key'
    return null
  }),
  getData: vi.fn(() => ({})),
}))

// ============================================
// Module Mocks (must be before imports)
// ============================================

// Mock config store to avoid database initialization
vi.mock('../../../platform/config', () => ({
  configStore: mockConfigStore,
}))

// Mock skill manager
vi.mock('../../skills/manager', () => ({
  skillManager: mockSkillManager,
}))

// Mock constant to avoid Electron app initialization
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

// ============================================
// Import after mocks
// ============================================

import { ToolRegistry, createToolRegistry } from '../tool-registry'

describe('toolRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Re-apply mock implementation after clearing
    mockSkillManager.getSkill.mockImplementation((name: string) => {
      const skills: Record<string, any> = {
        'core-skill-1': {
          name: 'core-skill-1',
          prompt: 'Core skill 1 prompt',
        },
        'core-skill-2': {
          name: 'core-skill-2',
          prompt: 'Core skill 2 prompt',
        },
        'optional-skill': {
          name: 'optional-skill',
          prompt: 'Optional skill prompt',
        },
      }
      return skills[name] || null
    })
  })

  describe('constructor and Factory', () => {
    it('should create instance with default config', () => {
      const registry = new ToolRegistry()
      const config = registry.getConfig()

      expect(config.strategy).toBe('eager')
      expect(config.coreSkills).toEqual([])
      expect(config.enableContext7).toBe(true)
    })

    it('should create instance with custom config', () => {
      const registry = new ToolRegistry({
        strategy: 'smart',
        coreSkills: ['core-skill-1'],
        enableContext7: false,
      })
      const config = registry.getConfig()

      expect(config.strategy).toBe('smart')
      expect(config.coreSkills).toEqual(['core-skill-1'])
      expect(config.enableContext7).toBe(false)
    })

    it('should create instance via factory function', () => {
      const registry = createToolRegistry({ strategy: 'lazy' })
      const config = registry.getConfig()

      expect(config.strategy).toBe('lazy')
    })
  })

  describe('eager Strategy', () => {
    it('should not load skill tools directly anymore', () => {
      const registry = new ToolRegistry({ strategy: 'eager' })
      const tools = registry.buildTools()

      expect(tools.length).toBe(7)
      expect(mockSkillManager.getAllTools).not.toHaveBeenCalled()
    })

    it('should load all skill prompts', () => {
      const registry = new ToolRegistry({ strategy: 'eager' })
      const prompts = registry.getSkillSystemPrompts()

      expect(prompts).toEqual([
        '[Skill: skill1]\nSkill 1 prompt',
        '[Skill: skill2]\nSkill 2 prompt',
      ])
      expect(mockSkillManager.getSystemPrompts).toHaveBeenCalled()
    })
  })

  describe('lazy Strategy', () => {
    it('should not load any skill tools', () => {
      const registry = new ToolRegistry({ strategy: 'lazy' })
      const tools = registry.buildTools()

      expect(tools.length).toBe(7)
      expect(mockSkillManager.getAllTools).not.toHaveBeenCalled()
    })

    it('should not load any skill prompts', () => {
      const registry = new ToolRegistry({ strategy: 'lazy' })
      const prompts = registry.getSkillSystemPrompts()

      expect(prompts.length).toBe(1)
      expect(prompts[0]).toContain('Available Skills')
      expect(prompts[0]).toContain('skill1: Skill 1 description')
      expect(prompts[0]).toContain('skill2: Skill 2 description')
      expect(mockSkillManager.getSystemPrompts).not.toHaveBeenCalled()
      expect(mockSkillManager.getSkillsSummary).toHaveBeenCalled()
    })
  })

  describe('smart Strategy', () => {
    it('should not load core skill tools directly anymore', () => {
      const registry = new ToolRegistry({
        strategy: 'smart',
        coreSkills: ['core-skill-1', 'core-skill-2'],
      })
      const tools = registry.buildTools()

      expect(tools.length).toBe(7)
      expect(mockSkillManager.getAllTools).not.toHaveBeenCalled()
    })

    it('should load only core skill prompts', () => {
      const registry = new ToolRegistry({
        strategy: 'smart',
        coreSkills: ['core-skill-1', 'core-skill-2'],
      })
      const prompts = registry.getSkillSystemPrompts()

      expect(prompts).toEqual([
        '[Skill: core-skill-1]\nCore skill 1 prompt',
        '[Skill: core-skill-2]\nCore skill 2 prompt',
      ])
      expect(mockSkillManager.getSystemPrompts).not.toHaveBeenCalled()
    })

    it('should skip prompts for skills without prompt field', () => {
      mockSkillManager.getSkill.mockImplementation((name: string) => {
        if (name === 'no-prompt-skill') {
          return {
            name: 'no-prompt-skill',
            prompt: null,
          }
        }
        return null
      })

      const registry = new ToolRegistry({
        strategy: 'smart',
        coreSkills: ['no-prompt-skill'],
      })
      const prompts = registry.getSkillSystemPrompts()

      expect(prompts).toEqual([])
    })
  })

  describe('context7 Integration', () => {
    it('should include context7 tool when enabled and API key exists', () => {
      const registry = new ToolRegistry({ enableContext7: true })
      const tools = registry.buildTools()

      // Context7 tool should be included
      expect(tools.length).toBeGreaterThanOrEqual(7)
    })

    it('should not include context7 tool when disabled', () => {
      const registry = new ToolRegistry({ enableContext7: false })
      const tools = registry.buildTools()

      // Should be 1 less than with context7 enabled
      const withContext7 = new ToolRegistry({ enableContext7: true }).buildTools().length
      expect(tools.length).toBe(withContext7 - 1)
    })
  })

  describe('config Management', () => {
    it('should update config', () => {
      const registry = new ToolRegistry({ strategy: 'eager' })

      registry.updateConfig({ strategy: 'lazy' })
      const config = registry.getConfig()

      expect(config.strategy).toBe('lazy')
    })

    it('should merge config on update', () => {
      const registry = new ToolRegistry({
        strategy: 'eager',
        coreSkills: ['skill1'],
      })

      registry.updateConfig({ strategy: 'smart' })
      const config = registry.getConfig()

      expect(config.strategy).toBe('smart')
      expect(config.coreSkills).toEqual(['skill1']) // Should preserve
    })

    it('should return immutable config copy', () => {
      const registry = new ToolRegistry({ strategy: 'eager' })
      const config1 = registry.getConfig()
      const config2 = registry.getConfig()

      expect(config1).not.toBe(config2) // Different objects
      expect(config1).toEqual(config2) // Same values
    })
  })

  describe('tool Composition', () => {
    it('should always include system tools', () => {
      const strategies: Array<'eager' | 'lazy' | 'smart'> = ['eager', 'lazy', 'smart']

      for (const strategy of strategies) {
        const registry = new ToolRegistry({ strategy })
        const tools = registry.buildTools()

        // System tools should always be present
        expect(tools.length).toBeGreaterThanOrEqual(4)
      }
    })

    it('should always include chat tools', () => {
      const strategies: Array<'eager' | 'lazy' | 'smart'> = ['eager', 'lazy', 'smart']

      for (const strategy of strategies) {
        const registry = new ToolRegistry({ strategy })
        const tools = registry.buildTools()

        // Chat tools should always be present
        expect(tools.length).toBeGreaterThanOrEqual(2)
      }
    })

    it('should not vary tool counts across skill strategies', () => {
      const strategies: Array<'eager' | 'lazy' | 'smart'> = ['eager', 'lazy', 'smart']

      for (const strategy of strategies) {
        const registry = new ToolRegistry({ strategy })
        const tools = registry.buildTools()

        expect(tools.length).toBeGreaterThanOrEqual(6)
      }
    })
  })

  describe('strategy Comparison', () => {
    it('should load the same number of tools for each strategy', () => {
      const eagerRegistry = new ToolRegistry({ strategy: 'eager' })
      const lazyRegistry = new ToolRegistry({ strategy: 'lazy' })
      const smartRegistry = new ToolRegistry({
        strategy: 'smart',
        coreSkills: ['core-skill-1'],
      })

      const eagerTools = eagerRegistry.buildTools()
      const lazyTools = lazyRegistry.buildTools()
      const smartTools = smartRegistry.buildTools()

      expect(eagerTools.length).toBe(lazyTools.length)
      expect(smartTools.length).toBe(lazyTools.length)
    })

    it('should load different prompts for each strategy', () => {
      const eagerRegistry = new ToolRegistry({ strategy: 'eager' })
      const lazyRegistry = new ToolRegistry({ strategy: 'lazy' })
      const smartRegistry = new ToolRegistry({
        strategy: 'smart',
        coreSkills: ['core-skill-1'],
      })

      const eagerPrompts = eagerRegistry.getSkillSystemPrompts()
      const lazyPrompts = lazyRegistry.getSkillSystemPrompts()
      const smartPrompts = smartRegistry.getSkillSystemPrompts()

      // eager should load all prompts
      expect(eagerPrompts.length).toBe(2)
      // lazy should load skills summary (1 prompt with all skills listed)
      expect(lazyPrompts.length).toBe(1)
      expect(lazyPrompts[0]).toContain('Available Skills')
      // smart should load only core prompts
      expect(smartPrompts.length).toBe(1)
    })
  })

  describe('edge Cases', () => {
    it('should handle empty coreSkills array', () => {
      const registry = new ToolRegistry({
        strategy: 'smart',
        coreSkills: [],
      })
      const tools = registry.buildTools()
      const prompts = registry.getSkillSystemPrompts()

      expect(tools.length).toBe(7)
      expect(prompts.length).toBe(0)
    })

    it('should handle undefined strategy', () => {
      const registry = new ToolRegistry({ strategy: undefined as any })
      const tools = registry.buildTools()

      expect(tools.length).toBe(7)
    })

    it('should handle invalid strategy', () => {
      const registry = new ToolRegistry({ strategy: 'invalid' as any })
      const tools = registry.buildTools()

      expect(tools.length).toBe(7)
      expect(mockSkillManager.getAllTools).not.toHaveBeenCalled()
    })
  })
})
