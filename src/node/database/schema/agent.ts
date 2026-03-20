import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { index } from 'drizzle-orm/sqlite-core'
import * as t from 'drizzle-orm/sqlite-core'
import { sqliteTableCreator } from 'drizzle-orm/sqlite-core'

export const sqliteTable = sqliteTableCreator(name => name)

/**
 * Agent metadata table
 * Stores runtime metadata like favorites and usage statistics
 */
export const agentMetadata = sqliteTable(
  'agent_metadata',
  {
    id: t.integer('id').primaryKey({ autoIncrement: true }),
    name: t.text('name').notNull().unique(),
    favorite: t.integer('favorite', { mode: 'boolean' }).notNull().default(false),
    useCount: t.integer('use_count').notNull().default(0),
    lastUsedAt: t.integer('last_used_at'),
    createdAt: t.integer('created_at').notNull(),
    updatedAt: t.integer('updated_at').notNull(),
  },
  (table) => ({
    nameIdx: index('idx_agent_metadata_name').on(table.name),
    favoriteIdx: index('idx_agent_metadata_favorite').on(table.favorite),
    lastUsedIdx: index('idx_agent_metadata_last_used').on(table.lastUsedAt),
  }),
)

export type AgentMetadata = InferSelectModel<typeof agentMetadata>
export type AgentMetadataInsert = InferInsertModel<typeof agentMetadata>
