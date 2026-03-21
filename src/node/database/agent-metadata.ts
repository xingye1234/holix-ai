import { desc, eq } from 'drizzle-orm'
import { getDb } from './connect'
import { agentMetadata } from './schema/agent'
import type { AgentMetadata } from './schema/agent'

/**
 * Get metadata for a specific agent
 */
export async function getAgentMetadata(name: string): Promise<AgentMetadata | undefined> {
  const db = getDb()
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

  const db = getDb()
  const result = await db.insert(agentMetadata).values({
    name,
    favorite: false,
    useCount: 0,
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
  const db = getDb()

  // Check if exists, if not create
  const existing = await getAgentMetadata(name)
  if (!existing) {
    const result = await db.insert(agentMetadata).values({
      name,
      ...updates,
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
  const db = getDb()
  return await db.select().from(agentMetadata).where(eq(agentMetadata.favorite, true))
}

/**
 * Get agents sorted by usage
 */
export async function getAgentsByUsage(limit = 10): Promise<AgentMetadata[]> {
  const db = getDb()
  return await db.select().from(agentMetadata).orderBy(desc(agentMetadata.useCount)).limit(limit)
}

/**
 * Delete agent metadata
 */
export async function deleteAgentMetadata(name: string): Promise<void> {
  const db = getDb()
  await db.delete(agentMetadata).where(eq(agentMetadata.name, name))
}
