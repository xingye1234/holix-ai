import { and, eq, sql } from 'drizzle-orm'
import { db } from './connect'
import { message, messageFts } from './schema/chat'

export interface SearchMessageOptions {
  /** 搜索关键词 */
  query: string
  /** 可选：限制在某个会话内搜索 */
  chatUid?: string
  /** 分页：限制返回数量，默认 20 */
  limit?: number
  /** 分页：偏移量，默认 0 */
  offset?: number
}

/**
 * 使用 FTS5 和 BM25 算法对消息进行全文搜索
 */
export async function searchMessagesBM25(options: SearchMessageOptions) {
  const { query, chatUid, limit = 20, offset = 0 } = options

  if (!query || !query.trim()) {
    return []
  }

  // 简单的 FTS5 查询转义，防止语法错误
  // 将双引号替换为两个双引号，并用双引号包裹整个查询词，实现精确匹配或前缀匹配
  const sanitizedQuery = `"${query.replace(/"/g, '""')}"`

  const conditions = [
    sql`${messageFts} MATCH ${sanitizedQuery}`,
  ]

  if (chatUid) {
    conditions.push(eq(messageFts.chatUid, chatUid))
  }

  // FTS5 的 rank 隐藏列默认使用 bm25() 算法
  // 返回的分数越小（越负）表示相关性越高，因此使用 ORDER BY rank ASC
  const results = await db
    .select({
      // 获取 BM25 相关性得分
      rank: sql<number>`rank`,
      // 关联获取原始消息的完整信息
      message,
    })
    .from(messageFts)
    .innerJoin(message, eq(messageFts.uid, message.uid))
    .where(and(...conditions))
    .orderBy(sql`rank`)
    .limit(limit)
    .offset(offset)

  return results
}
