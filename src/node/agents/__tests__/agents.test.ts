import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { beforeAll, afterEach, describe, it, expect } from 'vitest'
import { Agents } from '../index'
import { BUILTIN_AGENTS } from '../builtin'

describe('Agents', () => {
  const testDir = join(process.cwd(), '.test-agents')
  let agents: Agents

  beforeAll(async () => {
    // Create test directory
    await mkdir(testDir, { recursive: true })
    agents = new Agents(testDir)
    await agents.init()
  })

  afterEach(async () => {
    // Clean up after each test
    await rm(testDir, { recursive: true, force: true }).catch(() => {})
    await mkdir(testDir, { recursive: true })
    agents = new Agents(testDir)
    await agents.init()
  })

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      expect(agents).toBeDefined()
    })

    it('should have builtin agents', () => {
      const allAgents = agents.list()
      expect(allAgents.length).toBeGreaterThanOrEqual(BUILTIN_AGENTS.length)
      expect(allAgents.some(a => a.name === 'General Assistant')).toBe(true)
      expect(allAgents.some(a => a.name === 'Code Copilot')).toBe(true)
    })
  })

  describe('list', () => {
    it('should list all agents including builtin', () => {
      const list = agents.list()
      expect(list.length).toBeGreaterThanOrEqual(2)
      expect(list.some(a => a.isBuiltin)).toBe(true)
    })

    it('should filter by query', () => {
      const list = agents.list({ query: 'code' })
      expect(list.length).toBeGreaterThan(0)
      expect(list.every(a =>
        a.name.toLowerCase().includes('code')
        || a.description.toLowerCase().includes('code')
        || a.tags.some(t => t.toLowerCase().includes('code')),
      )).toBe(true)
    })

    it('should filter by category', () => {
      const list = agents.list({ category: 'development' })
      expect(list.length).toBeGreaterThan(0)
      expect(list.every(a => a.category === 'development')).toBe(true)
    })

    it('should sort by name', () => {
      const list = agents.list({ sortBy: 'name', sortOrder: 'asc' })
      const names = list.map(a => a.name)
      const sortedNames = [...names].sort()
      expect(names).toEqual(sortedNames)
    })
  })

  describe('get', () => {
    it('should get builtin agent by name', () => {
      const agent = agents.get('General Assistant')
      expect(agent).toBeDefined()
      expect(agent?.name).toBe('General Assistant')
      expect(agent?.isBuiltin).toBe(true)
    })

    it('should return undefined for non-existent agent', () => {
      const agent = agents.get('NonExistent')
      expect(agent).toBeUndefined()
    })
  })

  describe('create', () => {
    it('should create a new agent', async () => {
      const newAgent = await agents.create({
        name: 'test-agent',
        description: 'Test agent',
        prompt: 'You are a test assistant',
        skills: [],
        mcps: [],
      })

      expect(newAgent).toBeDefined()
      expect(newAgent.name).toBe('test-agent')
      expect(newAgent.isBuiltin).toBe(false)

      const retrieved = agents.get('test-agent')
      expect(retrieved).toBeDefined()
      expect(retrieved?.name).toBe('test-agent')
    })

    it('should throw error for duplicate name', async () => {
      await agents.create({
        name: 'duplicate-agent',
        prompt: 'Test',
      })

      await expect(agents.create({
        name: 'duplicate-agent',
        prompt: 'Test',
      })).rejects.toThrow()
    })

    it('should validate map values', async () => {
      await expect(agents.create({
        name: 'invalid-agent',
        prompt: 'Test',
        map: { planning: 1.5, reasoning: 0.5, toolUse: 0.5 },
      })).rejects.toThrow()
    })
  })

  describe('update', () => {
    it('should update an existing agent', async () => {
      await agents.create({
        name: 'update-test',
        description: 'Original',
        prompt: 'Original prompt',
      })

      const updated = await agents.update('update-test', {
        description: 'Updated',
        prompt: 'Updated prompt',
      })

      expect(updated.description).toBe('Updated')
      expect(updated.prompt).toBe('Updated prompt')

      const retrieved = agents.get('update-test')
      expect(retrieved?.description).toBe('Updated')
    })

    it('should throw error for builtin agent', async () => {
      await expect(agents.update('General Assistant', {
        description: 'Hacked',
      })).rejects.toThrow()
    })
  })

  describe('delete', () => {
    it('should delete a custom agent', async () => {
      await agents.create({
        name: 'delete-test',
        prompt: 'Test',
      })

      expect(agents.get('delete-test')).toBeDefined()

      await agents.delete('delete-test')

      expect(agents.get('delete-test')).toBeUndefined()
    })

    it('should throw error for builtin agent', async () => {
      await expect(agents.delete('General Assistant')).rejects.toThrow()
    })
  })

  describe('duplicate', () => {
    it('should duplicate an agent', async () => {
      await agents.create({
        name: 'source-agent',
        description: 'Source',
        prompt: 'Source prompt',
      })

      const duplicate = await agents.duplicate('source-agent', 'copied-agent')

      expect(duplicate.name).toBe('copied-agent')
      expect(duplicate.description).toContain('Copy')
      expect(duplicate.isBuiltin).toBe(false)

      expect(agents.get('source-agent')).toBeDefined()
      expect(agents.get('copied-agent')).toBeDefined()
    })

    it('should duplicate builtin agent', async () => {
      const duplicate = await agents.duplicate('General Assistant', 'my-assistant')

      expect(duplicate.name).toBe('my-assistant')
      expect(duplicate.isBuiltin).toBe(false)
      expect(agents.get('my-assistant')).toBeDefined()
    })
  })

  describe('export/import', () => {
    it('should export and import agent', async () => {
      await agents.create({
        name: 'export-test',
        description: 'Export me',
        prompt: 'Test prompt',
        category: 'test',
        tags: ['test'],
      })

      const exported = await agents.export('export-test')
      expect(exported).toBeDefined()
      expect(typeof exported).toBe('string')

      const parsed = JSON.parse(exported)
      expect(parsed.name).toBe('export-test')

      // Import with new name
      const imported = await agents.import(exported, 'imported-agent')
      expect(imported.name).toBe('imported-agent')
      expect(imported.description).toBe('Export me')
    })

    it('should reject invalid JSON', async () => {
      await expect(agents.import('invalid json')).rejects.toThrow()
    })

    it('should reject invalid agent data', async () => {
      const invalidData = JSON.stringify({ name: 'test' }) // missing prompt
      await expect(agents.import(invalidData)).rejects.toThrow()
    })
  })

  describe('search', () => {
    it('should search agents by query', async () => {
      await agents.create({
        name: 'search-test',
        description: 'Python coding expert',
        prompt: 'Test',
      })

      const results = agents.search('python')
      expect(results.length).toBeGreaterThan(0)
      expect(results.some(a => a.name === 'search-test')).toBe(true)
    })
  })

  describe('getCategories', () => {
    it('should return all categories', () => {
      const categories = agents.getCategories()
      expect(categories).toContain('general')
      expect(categories).toContain('development')
    })
  })

  describe('getTags', () => {
    it('should return all tags', () => {
      const tags = agents.getTags()
      expect(Array.isArray(tags)).toBe(true)
    })
  })
})
