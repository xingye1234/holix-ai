import { desc, eq } from 'drizzle-orm'
import { agentMetadata } from './schema/agent'
import type { AgentMetadata } from './schema/agent'
import { db } from './connect'

/**
 * Get metadata for a specific agent
 */
export async function getAgentMetadata(name: string): Promise<AgentMetadata | undefined> {
  const result = await db.select().from(agentMetadata).where(eq(agentMetadata.name, name)).limit(1)
  return result[0]
}

/**
 * Get or create metadata for an agent
 */
export async function getOrCreateAgentMetadata(name: string): Promise<AgentMetadata> {
  const existing = await getAgentMetadata(name)
  if (existing) {
    return existing
  }
  const result = await db.insert(agentMetadata).values({
    name,
    favorite: false,
    useCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }).returning()
  return result[0]
}

/**
 * Update agent metadata
 */
export async function updateAgentMetadata(
  name: string,
  updates: Partial<{
    favorite: boolean
    useCount: number
    lastUsedAt: number
  }>,
): Promise<AgentMetadata> {
  // Check if exists, if not create
  const existing = await getAgentMetadata(name)
  if (!existing) {
    const result = await db.insert(agentMetadata).values({
      name,
      ...updates,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }).returning()
    return result[0]
  }

  const result = await db.update(agentMetadata)
    .set({
      ...updates,
      updatedAt: Date.now(),
    })
    .where(eq(agentMetadata.name, name))
    .returning()

  return result[0]
}

/**
 * Toggle agent favorite status
 */
export async function toggleAgentFavorite(name: string): Promise<boolean> {
  const metadata = await getOrCreateAgentMetadata(name)
  const newFavorite = !metadata.favorite

  await updateAgentMetadata(name, { favorite: newFavorite })
  return newFavorite
}

/**
 * Increment agent use count
 */
export async function incrementAgentUse(name: string): Promise<void> {
  const metadata = await getOrCreateAgentMetadata(name)
  await updateAgentMetadata(name, {
    useCount: metadata.useCount + 1,
    lastUsedAt: Date.now(),
  })
}

/**
 * Get all favorite agents
 */
export async function getFavoriteAgents(): Promise<AgentMetadata[]> {
  return await db.select().from(agentMetadata).where(eq(agentMetadata.favorite, true))
}

/**
 * Get agents sorted by usage
 */
export async function getAgentsByUsage(limit = 10): Promise<AgentMetadata[]> {
  return await db.select().from(agentMetadata).orderBy(desc(agentMetadata.useCount)).limit(limit)
}

/**
 * Delete agent metadata
 */
export async function deleteAgentMetadata(name: string): Promise<void> {
  await db.delete(agentMetadata).where(eq(agentMetadata.name, name))
}
