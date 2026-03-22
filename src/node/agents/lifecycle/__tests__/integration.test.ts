import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { initializeOrchestrator } from '../orchestrator'
import { titleGeneratorAgent } from '../builtin/title-generator'
import { db } from '../../../database/connect'
import { chats, messages } from '../../../database/schema/chat'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

describe('Agent Lifecycle Integration', () => {
  let testChatUid: string

  beforeAll(async () => {
    // Initialize orchestrator and register agent
    const orchestrator = initializeOrchestrator(5000)
    orchestrator.registerAgent(titleGeneratorAgent, ['onMessageCompleted'], 10)

    // Create test chat
    testChatUid = randomUUID()
    await db.insert(chats).values({
      uid: testChatUid,
      title: '新对话',
      provider: 'openai',
      model: 'gpt-4',
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastSeq: 0
    })

    // Add test messages
    await db.insert(messages).values([
      {
        uid: randomUUID(),
        chatUid: testChatUid,
        seq: 1,
        role: 'user',
        kind: 'message',
        content: 'What is TypeScript?',
        status: 'done',
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        uid: randomUUID(),
        chatUid: testChatUid,
        seq: 2,
        role: 'assistant',
        kind: 'message',
        content: 'TypeScript is a typed superset of JavaScript...',
        status: 'done',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ])
  })

  afterAll(async () => {
    // Cleanup
    await db.delete(messages).where(eq(messages.chatUid, testChatUid))
    await db.delete(chats).where(eq(chats.uid, testChatUid))
  })

  it('should execute agent on hook trigger', async () => {
    const orchestrator = initializeOrchestrator()

    // Trigger hook
    const results = await orchestrator.triggerHook('onMessageCompleted', testChatUid)

    // Verify execution
    expect(results.length).toBeGreaterThan(0)

    const titleResult = results.find(r => r.agentId === 'builtin:title-generator')
    expect(titleResult).toBeDefined()
    expect(titleResult?.status).toBe('success')
    expect(titleResult?.data).toEqual({ title: 'What is TypeScript?' })
  })

  it('should update title in database', async () => {
    const orchestrator = initializeOrchestrator()

    // Trigger hook
    await orchestrator.triggerHook('onMessageCompleted', testChatUid)

    // Verify title was updated
    const updatedChat = await db.select().from(chats).where(eq(chats.uid, testChatUid)).limit(1)
    expect(updatedChat[0].title).toBe('What is TypeScript?')
  })

  it('should log execution to database', async () => {
    const { agentExecutionLog } = await import('../../../database/schema/lifecycle-agent')

    const orchestrator = initializeOrchestrator()

    // Trigger hook
    await orchestrator.triggerHook('onMessageCompleted', testChatUid)

    // Verify execution log
    const logs = await db.select()
      .from(agentExecutionLog)
      .where(eq(agentExecutionLog.chatUid, testChatUid))

    expect(logs.length).toBeGreaterThan(0)
    expect(logs[0].agentId).toBe('builtin:title-generator')
    expect(logs[0].status).toBe('success')
  })
})
