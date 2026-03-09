import { desc, eq } from 'drizzle-orm'
import { db, getDatabase } from './connect'
import { skillInvocationLog } from './schema/chat'

interface RecordSkillInvocationParams {
  skillName: string
  toolName: string
  args?: Record<string, unknown>
  result?: string
  rejected?: boolean
  error?: string
}

interface ListSkillInvocationLogsParams {
  limit?: number
  offset?: number
  skillName?: string
}

export function recordSkillInvocation(params: RecordSkillInvocationParams): void {
  db.insert(skillInvocationLog)
    .values({
      skillName: params.skillName,
      toolName: params.toolName,
      args: params.args ?? null,
      result: params.result ?? null,
      rejected: params.rejected ?? false,
      error: params.error ?? null,
    })
    .run()
}

export async function listSkillInvocationLogs(
  params: ListSkillInvocationLogsParams = {},
) {
  const conn = await getDatabase()
  const limit = Math.max(1, Math.min(params.limit ?? 200, 1000))
  const offset = Math.max(0, params.offset ?? 0)

  if (params.skillName) {
    return await conn
      .select()
      .from(skillInvocationLog)
      .where(eq(skillInvocationLog.skillName, params.skillName))
      .orderBy(desc(skillInvocationLog.createdAt), desc(skillInvocationLog.id))
      .limit(limit)
      .offset(offset)
  }

  return await conn
    .select()
    .from(skillInvocationLog)
    .orderBy(desc(skillInvocationLog.createdAt), desc(skillInvocationLog.id))
    .limit(limit)
    .offset(offset)
}
