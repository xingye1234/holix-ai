import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

/**
 * Agent execution log - records every agent execution
 */
export const agentExecutionLog = sqliteTable(
  'agent_execution_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uid: text('uid').notNull().unique(),
    chatUid: text('chat_uid').notNull(),
    agentId: text('agent_id').notNull(),
    hook: text('hook').notNull(),
    status: text('status', { enum: ['success', 'error'] }).notNull(),
    resultData: text('result_data', { mode: 'json' }),
    error: text('error'),
    duration: integer('duration'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => ({
    chatIdx: index('idx_agent_execution_chat').on(table.chatUid),
    agentIdx: index('idx_agent_execution_agent').on(table.agentId),
    createdAtIdx: index('idx_agent_execution_created').on(table.createdAt),
  })
)

export type AgentExecutionLog = typeof agentExecutionLog.$inferSelect
