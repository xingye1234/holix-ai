import z from 'zod'
import { agents } from '../agents'
import {
  deleteAgentMetadata,
  getAgentMetadata,
  getOrCreateAgentMetadata,
  incrementAgentUse,
  toggleAgentFavorite,
} from '../database/agent-metadata'
import { procedure, router } from './trpc'
import { getOrchestrator } from '../agents/lifecycle'
import { agentExecutionLog } from '../database/schema/lifecycle-agent'
import { eq, desc } from 'drizzle-orm'
import { db } from '../database/connect'

/**
 * Zod schemas for validation
 */
const AgentVariableSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean']),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  description: z.string().optional(),
})

const AgentMapSchema = z.object({
  planning: z.number().min(0).max(1),
  reasoning: z.number().min(0).max(1),
  toolUse: z.number().min(0).max(1),
})

const CreateAgentSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  category: z.string().default('general'),
  tags: z.array(z.string()).default([]),
  prompt: z.string().min(1),
  skills: z.array(z.string()).default([]),
  mcps: z.array(z.string()).default([]),
  provider: z.string().default(''),
  model: z.string().default(''),
  variables: z.array(AgentVariableSchema).default([]),
  map: AgentMapSchema.optional(),
})

const UpdateAgentSchema = z.object({
  description: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  prompt: z.string().optional(),
  skills: z.array(z.string()).optional(),
  mcps: z.array(z.string()).optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  variables: z.array(AgentVariableSchema).optional(),
  map: AgentMapSchema.optional(),
})

const ListOptionsSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  sortBy: z.enum(['name', 'created', 'lastUsed', 'useCount']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  favoritesOnly: z.boolean().optional(),
}).optional()

/**
 * Agent Router
 * tRPC router for agent operations
 */
export const agentRouter = router({
  /**
   * List all agents with optional filtering and sorting
   */
  list: procedure()
    .input(ListOptionsSchema)
    .query(async ({ input }) => {
      const allAgents = agents.list(input)

      // Filter by favorites if requested
      let result = allAgents
      if (input?.favoritesOnly) {
        const favorites = await Promise.all(
          allAgents.map(async (agent) => {
            const metadata = await getAgentMetadata(agent.name)
            return metadata?.favorite ? agent : null
          }),
        )
        result = favorites.filter(Boolean) as typeof allAgents
      }

      // Attach metadata to agents
      const agentsWithMetadata = await Promise.all(
        result.map(async (agent) => {
          const metadata = await getAgentMetadata(agent.name)
          return {
            ...agent,
            favorite: metadata?.favorite ?? false,
            useCount: metadata?.useCount ?? 0,
            lastUsedAt: metadata?.lastUsedAt ?? null,
          }
        }),
      )

      // Sort by useCount if requested (requires metadata)
      if (input?.sortBy === 'useCount') {
        agentsWithMetadata.sort((a, b) => {
          const aCount = (a as any).useCount ?? 0
          const bCount = (b as any).useCount ?? 0
          return input.sortOrder === 'desc' ? bCount - aCount : aCount - bCount
        })
      }

      return agentsWithMetadata
    }),

  /**
   * Get a single agent by name
   */
  get: procedure()
    .input(z.object({ name: z.string() }))
    .query(async ({ input }) => {
      const agent = agents.get(input.name)
      if (!agent) {
        throw new Error(`Agent "${input.name}" not found`)
      }

      const metadata = await getAgentMetadata(agent.name)
      return {
        ...agent,
        favorite: metadata?.favorite ?? false,
        useCount: metadata?.useCount ?? 0,
        lastUsedAt: metadata?.lastUsedAt ?? null,
      }
    }),

  /**
   * Get categories
   */
  getCategories: procedure()
    .query(() => {
      return agents.getCategories()
    }),

  /**
   * Get tags
   */
  getTags: procedure()
    .query(() => {
      return agents.getTags()
    }),

  /**
   * Create a new agent
   */
  create: procedure()
    .input(CreateAgentSchema)
    .mutation(async ({ input }) => {
      const agent = await agents.create(input)
      await getOrCreateAgentMetadata(agent.name)
      return agent
    }),

  /**
   * Update an existing agent
   */
  update: procedure()
    .input(z.object({
      name: z.string(),
      updates: UpdateAgentSchema,
    }))
    .mutation(async ({ input }) => {
      const agent = await agents.update(input.name, input.updates)
      return agent
    }),

  /**
   * Delete an agent
   */
  delete: procedure()
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => {
      await agents.delete(input.name)
      await deleteAgentMetadata(input.name)
      return { success: true }
    }),

  /**
   * Duplicate an agent
   */
  duplicate: procedure()
    .input(z.object({
      name: z.string(),
      newName: z.string(),
    }))
    .mutation(async ({ input }) => {
      const agent = await agents.duplicate(input.name, input.newName)
      return agent
    }),

  /**
   * Toggle agent favorite status
   */
  toggleFavorite: procedure()
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => {
      const favorite = await toggleAgentFavorite(input.name)
      return { favorite }
    }),

  /**
   * Export an agent to JSON
   */
  export: procedure()
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => {
      const json = await agents.export(input.name)
      return { json }
    }),

  /**
   * Import an agent from JSON
   */
  import: procedure()
    .input(z.object({
      json: z.string(),
      overrideName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const agent = await agents.import(input.json, input.overrideName)
      await getOrCreateAgentMetadata(agent.name)
      return agent
    }),

  /**
   * Reload agents from filesystem
   */
  reload: procedure()
    .mutation(() => {
      agents.reload()
      return { success: true }
    }),

  /**
   * Track agent usage (called when agent is used in chat)
   */
  trackUsage: procedure()
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => {
      await incrementAgentUse(input.name)
      return { success: true }
    }),

  /**
   * Manually trigger a lifecycle agent hook
   */
  triggerLifecycleHook: procedure()
    .input(z.object({
      chatUid: z.string().min(1),
      hook: z.enum([
        'onChatCreated',
        'onMessageCompleted',
        'onChatIdle',
        'onMessageError'
      ])
    }))
    .mutation(async ({ input }) => {
      const orchestrator = getOrchestrator()
      if (!orchestrator) {
        throw new Error('Agent lifecycle system not initialized')
      }

      try {
        const results = await orchestrator.triggerHook(input.hook, input.chatUid)
        return { success: true, results }
      } catch (error) {
        console.error('Manual lifecycle hook trigger failed:', error)
        throw new Error('Failed to trigger lifecycle hook')
      }
    }),

  /**
   * List all registered lifecycle agents
   */
  listLifecycleAgents: procedure()
    .query(async () => {
      const orchestrator = getOrchestrator()
      if (!orchestrator) {
        return []
      }
      return orchestrator.getRegisteredAgents()
    }),

  /**
   * Get lifecycle execution history for a chat
   */
  getLifecycleExecutionHistory: procedure()
    .input(z.object({
      chatUid: z.string(),
      limit: z.number().optional().default(50)
    }))
    .query(async ({ input }) => {
      return db.select()
        .from(agentExecutionLog)
        .where(eq(agentExecutionLog.chatUid, input.chatUid))
        .orderBy(desc(agentExecutionLog.createdAt))
        .limit(input.limit)
    }),
})
