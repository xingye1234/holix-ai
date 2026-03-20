import { readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { logger } from '../platform/logger'
import { BUILTIN_AGENTS } from './builtin'
import type { Agent, CreateAgentInput, ListOptions, UpdateAgentInput } from './types'
import { loadAndValidateAgentFile, validateAgentData, validateMap } from './validator'

export class Agents {
  private agentsDir: string
  private customAgents: Map<string, Agent> = new Map()
  private isInitialized = false

  constructor(agentsDir: string) {
    this.agentsDir = agentsDir
  }

  /**
   * Initialize agents system
   */
  async init(): Promise<void> {
    if (this.isInitialized)
      return

    try {
      // Load custom agents from filesystem
      await this.loadCustomAgents()
      this.isInitialized = true
      logger.info('[Agents] Agent system initialized')
    }
    catch (error) {
      logger.error('[Agents] Failed to initialize:', error)
      throw error
    }
  }

  /**
   * Reload agents from filesystem
   */
  reload(): void {
    logger.info('[Agents] Reloading agents...')
    this.customAgents.clear()
    this.loadCustomAgents().catch((error) => {
      logger.error('[Agents] Failed to reload agents:', error)
    })
  }

  /**
   * List all agents (builtin + custom)
   */
  list(options?: ListOptions): Agent[] {
    const allAgents = [...BUILTIN_AGENTS, ...Array.from(this.customAgents.values())]

    let filtered = allAgents

    // Filter by query
    if (options?.query) {
      const query = options.query.toLowerCase()
      filtered = filtered.filter(agent =>
        agent.name.toLowerCase().includes(query)
        || agent.description.toLowerCase().includes(query)
        || agent.tags.some(tag => tag.toLowerCase().includes(query)),
      )
    }

    // Filter by category
    if (options?.category) {
      filtered = filtered.filter(agent => agent.category === options.category)
    }

    // Filter by tags
    if (options?.tags && options.tags.length > 0) {
      filtered = filtered.filter(agent =>
        options.tags!.some(tag => agent.tags.includes(tag)),
      )
    }

    // Sort
    if (options?.sortBy) {
      filtered = this.sortAgents(filtered, options.sortBy, options.sortOrder || 'asc')
    }

    return filtered
  }

  /**
   * Get a single agent by name
   */
  get(name: string): Agent | undefined {
    // Check builtin first
    const builtin = BUILTIN_AGENTS.find(a => a.name === name)
    if (builtin)
      return builtin

    // Check custom
    return this.customAgents.get(name)
  }

  /**
   * Get agent by ID
   */
  getById(id: string): Agent | undefined {
    // Check builtin
    const builtin = BUILTIN_AGENTS.find(a => a.id === id)
    if (builtin)
      return builtin

    // Check custom
    return Array.from(this.customAgents.values()).find(a => a.id === id)
  }

  /**
   * Create a new custom agent
   */
  async create(input: CreateAgentInput): Promise<Agent> {
    // Check if agent already exists
    if (this.get(input.name)) {
      throw new Error(`Agent "${input.name}" already exists`)
    }

    // Validate map if provided
    if (input.map) {
      const mapValidation = validateMap(input.map)
      if (!mapValidation.valid) {
        throw new Error(`Invalid map: ${mapValidation.error}`)
      }
    }

    const agent: Agent = {
      id: input.name,
      version: '1.0.0',
      name: input.name,
      description: input.description || '',
      category: input.category || 'general',
      tags: input.tags || [],
      prompt: input.prompt,
      skills: input.skills || [],
      mcps: input.mcps || [],
      provider: input.provider || '',
      model: input.model || '',
      variables: input.variables || [],
      map: input.map || { planning: 0.5, reasoning: 0.5, toolUse: 0.5 },
      isBuiltin: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    // Save to filesystem
    await this.saveAgent(agent)

    // Add to cache
    this.customAgents.set(agent.name, agent)

    logger.info(`[Agents] Created agent: ${agent.name}`)
    return agent
  }

  /**
   * Update an existing agent
   */
  async update(name: string, updates: UpdateAgentInput): Promise<Agent> {
    const agent = this.customAgents.get(name)
    if (!agent) {
      throw new Error(`Agent "${name}" not found or is builtin`)
    }

    // Validate map if provided
    if (updates.map) {
      const mapValidation = validateMap(updates.map)
      if (!mapValidation.valid) {
        throw new Error(`Invalid map: ${mapValidation.error}`)
      }
    }

    // Apply updates
    const updated: Agent = {
      ...agent,
      ...updates,
      updatedAt: Date.now(),
    }

    // Save to filesystem
    await this.saveAgent(updated)

    // Update cache
    this.customAgents.set(name, updated)

    logger.info(`[Agents] Updated agent: ${name}`)
    return updated
  }

  /**
   * Delete an agent
   */
  async delete(name: string): Promise<void> {
    const agent = this.customAgents.get(name)
    if (!agent) {
      throw new Error(`Agent "${name}" not found or is builtin`)
    }

    // Delete from filesystem
    const filePath = this.getAgentFilePath(name)
    try {
      await unlink(filePath)
      this.customAgents.delete(name)
      logger.info(`[Agents] Deleted agent: ${name}`)
    }
    catch (error) {
      logger.error(`[Agents] Failed to delete agent file: ${filePath}`, error)
      throw error
    }
  }

  /**
   * Duplicate an agent
   */
  async duplicate(name: string, newName: string): Promise<Agent> {
    const source = this.get(name)
    if (!source) {
      throw new Error(`Agent "${name}" not found`)
    }

    if (this.get(newName)) {
      throw new Error(`Agent "${newName}" already exists`)
    }

    const duplicate: Agent = {
      ...source,
      id: newName,
      name: newName,
      description: `${source.description} (Copy)`,
      isBuiltin: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    await this.saveAgent(duplicate)
    this.customAgents.set(newName, duplicate)

    logger.info(`[Agents] Duplicated agent: ${name} -> ${newName}`)
    return duplicate
  }

  /**
   * Export an agent to JSON string
   */
  async export(name: string): Promise<string> {
    const agent = this.get(name)
    if (!agent) {
      throw new Error(`Agent "${name}" not found`)
    }

    // Export without runtime fields
    const { id, isBuiltin, createdAt, updatedAt, ...exportData } = agent
    return JSON.stringify(exportData, null, 2)
  }

  /**
   * Import an agent from JSON string
   */
  async import(jsonString: string, overrideName?: string): Promise<Agent> {
    const validation = validateAgentData(JSON.parse(jsonString))
    if (!validation.success) {
      throw new Error(`Invalid agent data: ${validation.error}`)
    }

    const data = validation.data!
    const name = overrideName || data.name

    // Create as custom agent
    const agent: Agent = {
      id: name,
      ...data,
      name,
      isBuiltin: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    await this.saveAgent(agent)
    this.customAgents.set(name, agent)

    logger.info(`[Agents] Imported agent: ${name}`)
    return agent
  }

  /**
   * Search agents by query
   */
  search(query: string): Agent[] {
    return this.list({ query })
  }

  /**
   * Get all categories
   */
  getCategories(): string[] {
    const categories = new Set<string>()
    this.list().forEach(agent => categories.add(agent.category))
    return Array.from(categories).sort()
  }

  /**
   * Get all tags
   */
  getTags(): string[] {
    const tags = new Set<string>()
    this.list().forEach(agent => agent.tags.forEach(tag => tags.add(tag)))
    return Array.from(tags).sort()
  }

  /**
   * Get agents directory path
   */
  getAgentsDir(): string {
    return this.agentsDir
  }

  // ============================================================
  // Private Methods
  // ============================================================

  /**
   * Load custom agents from filesystem
   */
  private async loadCustomAgents(): Promise<void> {
    try {
      const files = await readdir(this.agentsDir)
      const jsonFiles = files.filter(f => f.endsWith('.json'))

      for (const file of jsonFiles) {
        const filePath = resolve(this.agentsDir, file)
        try {
          const result = await loadAndValidateAgentFile(filePath)
          if (result.success && result.data) {
            const agent: Agent = {
              id: result.data.name,
              ...result.data,
              isBuiltin: false,
              createdAt: (await stat(filePath)).birthtimeMs,
              updatedAt: (await stat(filePath)).mtimeMs,
            }
            this.customAgents.set(agent.name, agent)
          }
          else {
            logger.warn(`[Agents] Invalid agent file ${file}: ${result.error}`)
          }
        }
        catch (error) {
          logger.warn(`[Agents] Failed to load agent file ${file}:`, error)
        }
      }

      logger.info(`[Agents] Loaded ${this.customAgents.size} custom agents`)
    }
    catch (error) {
      // Directory might not exist yet, that's ok
      logger.warn('[Agents] Failed to load custom agents (directory may not exist):', error)
    }
  }

  /**
   * Save an agent to filesystem
   */
  private async saveAgent(agent: Agent): Promise<void> {
    const filePath = this.getAgentFilePath(agent.name)

    // Remove runtime fields before saving
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, isBuiltin, createdAt, updatedAt, ...saveData } = agent

    await writeFile(filePath, JSON.stringify(saveData, null, 2), 'utf-8')
  }

  /**
   * Get file path for an agent
   */
  private getAgentFilePath(name: string): string {
    return resolve(this.agentsDir, `${name}.json`)
  }

  /**
   * Sort agents by field
   */
  private sortAgents(agents: Agent[], sortBy: string, order: 'asc' | 'desc'): Agent[] {
    const sorted = [...agents].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'created':
          return a.createdAt - b.createdAt
        case 'lastUsed':
          // For now, sort by updatedAt (will be replaced with metadata)
          return a.updatedAt - b.updatedAt
        default:
          return 0
      }
    })

    return order === 'desc' ? sorted.reverse() : sorted
  }
}
