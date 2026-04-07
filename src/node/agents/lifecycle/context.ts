import { db } from '../../database/connect'
import { chats, message } from '../../database/schema/chat'
import { eq, desc } from 'drizzle-orm'
import type { AgentContext, AgentHook } from './types'

/**
 * Context Provider - fetches chat context for agent execution
 */
export class ContextProvider {
  /**
   * Get agent execution context
   */
  async getContext(
    chatUid: string,
    hook: AgentHook,
    eventData?: unknown,
  ): Promise<AgentContext> {
    // Fetch chat and messages in parallel
    const [chatResult, messagesResult] = await Promise.all([
      db.select().from(chats).where(eq(chats.uid, chatUid)).limit(1),
      db.select()
        .from(message)
        .where(eq(message.chatUid, chatUid))
        .orderBy(desc(message.seq))
        .limit(10), // Use chat.contextSettings.maxMessages in full implementation
    ])

    if (!chatResult[0]) {
      throw new Error(`Chat not found: ${chatUid}`)
    }

    return {
      chatUid,
      messages: messagesResult.reverse(), // Reverse to get chronological order
      chat: chatResult[0],
      event: {
        hook,
        data: eventData,
      },
    }
  }
}

export const contextProvider = new ContextProvider()
