import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { beforeAll, afterEach, describe, it, expect } from 'vitest'
import { loadAndValidateAgentFile, validateAgentData, validateMap } from '../validator'

describe('Agent Validator', () => {
  const testDir = join(process.cwd(), '.test-validator')
  const testFile = join(testDir, 'test-agent.json')

  beforeAll(async () => {
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await unlink(testFile).catch(() => {})
  })

  describe('loadAndValidateAgentFile', () => {
    it('should validate correct agent file', async () => {
      const validAgent = {
        version: '1.0.0',
        name: 'Test Agent',
        description: 'Test description',
        category: 'test',
        tags: ['test'],
        prompt: 'You are a test assistant',
        skills: [],
        mcps: [],
        provider: '',
        model: '',
        variables: [],
        map: { planning: 0.5, reasoning: 0.5, toolUse: 0.5 },
      }

      await writeFile(testFile, JSON.stringify(validAgent), 'utf-8')
      const result = await loadAndValidateAgentFile(testFile)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.name).toBe('Test Agent')
    })

    it('should reject invalid JSON', async () => {
      await writeFile(testFile, 'invalid json', 'utf-8')
      const result = await loadAndValidateAgentFile(testFile)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should reject missing required fields', async () => {
      const invalidAgent = {
        name: 'Test',
        // missing prompt
      }

      await writeFile(testFile, JSON.stringify(invalidAgent), 'utf-8')
      const result = await loadAndValidateAgentFile(testFile)

      expect(result.success).toBe(false)
      expect(result.error).toContain('prompt')
    })

    it('should apply defaults', async () => {
      const minimalAgent = {
        name: 'Minimal',
        prompt: 'Test',
      }

      await writeFile(testFile, JSON.stringify(minimalAgent), 'utf-8')
      const result = await loadAndValidateAgentFile(testFile)

      expect(result.success).toBe(true)
      expect(result.data?.version).toBe('1.0.0')
      expect(result.data?.category).toBe('general')
      expect(result.data?.tags).toEqual([])
    })
  })

  describe('validateAgentData', () => {
    it('should validate correct data', () => {
      const validAgent = {
        name: 'Test',
        prompt: 'Test prompt',
      }

      const result = validateAgentData(validAgent)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('should reject invalid data', () => {
      const result = validateAgentData({ name: 'Test' })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should validate variables schema', () => {
      const agentWithVars = {
        name: 'Test',
        prompt: 'Test',
        variables: [
          { name: 'lang', type: 'string', default: 'TS' },
          { name: 'count', type: 'number', default: 10 },
        ],
      }

      const result = validateAgentData(agentWithVars)

      expect(result.success).toBe(true)
      expect(result.data?.variables).toHaveLength(2)
    })

    it('should reject invalid variable type', () => {
      const agentWithInvalidVar = {
        name: 'Test',
        prompt: 'Test',
        variables: [
          { name: 'bad', type: 'invalid' },
        ],
      }

      const result = validateAgentData(agentWithInvalidVar)

      expect(result.success).toBe(false)
      expect(result.error).toContain('type')
    })
  })

  describe('validateMap', () => {
    it('should validate correct map', () => {
      const map = { planning: 0.5, reasoning: 0.7, toolUse: 0.9 }
      const result = validateMap(map)

      expect(result.valid).toBe(true)
    })

    it('should reject non-object', () => {
      expect(validateMap(null).valid).toBe(false)
      expect(validateMap('string').valid).toBe(false)
      expect(validateMap(123).valid).toBe(false)
    })

    it('should reject missing keys', () => {
      const result = validateMap({ planning: 0.5, reasoning: 0.5 })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('toolUse')
    })

    it('should reject out of range values', () => {
      expect(validateMap({ planning: 1.5, reasoning: 0.5, toolUse: 0.5 }).valid).toBe(false)
      expect(validateMap({ planning: -0.1, reasoning: 0.5, toolUse: 0.5 }).valid).toBe(false)
    })

    it('should reject non-number values', () => {
      const result = validateMap({ planning: '0.5' as any, reasoning: 0.5, toolUse: 0.5 })
      expect(result.valid).toBe(false)
    })
  })
})
