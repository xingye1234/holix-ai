/**
 * Agent System Type Definitions
 */

export interface AgentVariable {
  name: string
  type: 'string' | 'number' | 'boolean'
  default?: string | number | boolean
  description?: string
}

export interface AgentMap {
  planning: number
  reasoning: number
  toolUse: number
}

export interface AgentFile {
  version: string
  name: string
  description: string
  category: string
  tags: string[]
  prompt: string
  skills: string[]
  mcps: string[]
  provider: string
  model: string
  variables: AgentVariable[]
  map: Record<string, number>
}

export interface Agent extends AgentFile {
  id: string
  isBuiltin: boolean
  createdAt: number
  updatedAt: number
}

export interface CreateAgentInput {
  name: string
  description?: string
  category?: string
  tags?: string[]
  prompt: string
  skills?: string[]
  mcps?: string[]
  provider?: string
  model?: string
  variables?: AgentVariable[]
  map?: Record<string, number>
}

export interface UpdateAgentInput {
  description?: string
  category?: string
  tags?: string[]
  prompt?: string
  skills?: string[]
  mcps?: string[]
  provider?: string
  model?: string
  variables?: AgentVariable[]
  map?: Record<string, number>
}

export interface ListOptions {
  query?: string
  category?: string
  tags?: string[]
  sortBy?: 'name' | 'created' | 'lastUsed' | 'useCount'
  sortOrder?: 'asc' | 'desc'
  favoritesOnly?: boolean
}

export interface AgentMetadata {
  id: number
  name: string
  favorite: boolean
  useCount: number
  lastUsedAt: number | null
  createdAt: number
}

export interface AgentWithMetadata extends Agent {
  favorite?: boolean
  useCount?: number
  lastUsedAt?: number | null
}
