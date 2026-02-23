import type { ChatContext } from '../context'
import { tool } from 'langchain'
import z from 'zod'
import { findMessagesByTime, searchMessages } from '../../database/message-search'
import { logger } from '../../platform/logger'

export const chatTimeSearchTool = tool(
  async ({ time, direction, limit = 1 }, config: { context: ChatContext }) => {
    const chatUid = config.context.chatUid

    logger.info('[chatTimeSearchTool] Searching messages by time', { time, direction, limit, chatUid })

    const messages = findMessagesByTime({ time, direction, chatUid, limit })

    logger.info(`[chatTimeSearchTool] Found ${messages.length} message(s)`)

    return messages.map(msg => ({
      uid: msg.uid,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt,
    }))
  },
  {
    name: 'chat_time_search',
    description: 'Find chat messages relative to a given timestamp. Use direction="before" to get messages sent before that time, or "after" for messages sent after it. Returns the closest messages to the reference time.',
    schema: z.object({
      time: z.number().describe('Reference timestamp in milliseconds (e.g. Date.now())'),
      direction: z.enum(['before', 'after']).describe('"before" returns the most recent messages before this time; "after" returns the earliest messages after this time'),
      limit: z.number().int().min(1).max(50).optional().default(1).describe('Number of messages to return (default 1, max 50)'),
    }),
  },
)

export const chatKeywordSearchTool = tool(
  async ({ query, limit = 10, offset = 0 }, config: { context: ChatContext }) => {
    const chatUid = config.context.chatUid

    logger.info('[chatKeywordSearchTool] Searching messages by keyword', { query, limit, offset, chatUid })

    const results = searchMessages({ query, chatUid, limit, offset })

    logger.info(`[chatKeywordSearchTool] Found ${results.length} result(s) for query: "${query}"`)

    return results.map(({ message: msg }) => ({
      uid: msg.uid,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt,
    }))
  },
  {
    name: 'chat_keyword_search',
    description: 'Search chat messages by keyword. Returns messages whose content contains the given keyword (case-insensitive substring match). Optionally scoped to the current chat session.',
    schema: z.object({
      query: z.string().min(1).describe('The keyword or phrase to search for in message content'),
      limit: z.number().int().min(1).max(50).optional().default(10).describe('Maximum number of results to return (default 10, max 50)'),
      offset: z.number().int().min(0).optional().default(0).describe('Pagination offset (default 0)'),
    }),
  },
)
