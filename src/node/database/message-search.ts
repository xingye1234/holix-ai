import type { Message } from './schema/chat'
import { sqlite } from './connect'

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

export interface SearchMessageResult {
  rank: number
  message: Message
}

/**
 * 使用 FTS5 和 BM25 算法对消息进行全文搜索
 *
 * 直接使用 better-sqlite3 raw SQL 绕过 Drizzle 查询构建器，
 * 因为 Drizzle 会将表对象用引号包裹成列名标识符，导致 FTS5 的
 * MATCH 语法和 bm25() 函数无法正确识别虚拟表名。
 */
export async function searchMessagesBM25(options: SearchMessageOptions): Promise<SearchMessageResult[]> {
  const { query, chatUid, limit = 20, offset = 0 } = options

  if (!query || !query.trim()) {
    return []
  }

  // FTS5 查询转义：将双引号转义，并包裹整个词，支持精确匹配
  const sanitizedQuery = `"${query.replace(/"/g, '""')}"`

  let sqlStr: string
  let params: any[]

  if (chatUid) {
    sqlStr = `
      SELECT
        bm25(message_fts) AS rank,
        m.id, m.uid, m.seq, m.chat_uid AS chatUid, m.role, m.kind,
        m.content, m.draft_content AS draftContent, m.status, m.model,
        m.searchable, m.search_index_version AS searchIndexVersion,
        m.parent_uid AS parentUid, m.request_id AS requestId,
        m.stream_id AS streamId, m.tool_name AS toolName,
        m.tool_payload AS toolPayload, m.error,
        m.created_at AS createdAt, m.updated_at AS updatedAt
      FROM message_fts
      INNER JOIN message m ON message_fts.uid = m.uid
      WHERE message_fts MATCH ? AND message_fts.chat_uid = ?
      ORDER BY bm25(message_fts)
      LIMIT ? OFFSET ?
    `
    params = [sanitizedQuery, chatUid, limit, offset]
  }
  else {
    sqlStr = `
      SELECT
        bm25(message_fts) AS rank,
        m.id, m.uid, m.seq, m.chat_uid AS chatUid, m.role, m.kind,
        m.content, m.draft_content AS draftContent, m.status, m.model,
        m.searchable, m.search_index_version AS searchIndexVersion,
        m.parent_uid AS parentUid, m.request_id AS requestId,
        m.stream_id AS streamId, m.tool_name AS toolName,
        m.tool_payload AS toolPayload, m.error,
        m.created_at AS createdAt, m.updated_at AS updatedAt
      FROM message_fts
      INNER JOIN message m ON message_fts.uid = m.uid
      WHERE message_fts MATCH ?
      ORDER BY bm25(message_fts)
      LIMIT ? OFFSET ?
    `
    params = [sanitizedQuery, limit, offset]
  }

  const rows = sqlite.prepare(sqlStr).all(...params) as Array<Record<string, any>>

  return rows.map(row => ({
    rank: row.rank as number,
    message: {
      id: row.id,
      uid: row.uid,
      seq: row.seq,
      chatUid: row.chatUid,
      role: row.role,
      kind: row.kind,
      content: row.content ?? null,
      draftContent: row.draftContent ? JSON.parse(row.draftContent) : null,
      status: row.status,
      model: row.model ?? null,
      searchable: Boolean(row.searchable),
      searchIndexVersion: row.searchIndexVersion ?? null,
      parentUid: row.parentUid ?? null,
      requestId: row.requestId ?? null,
      streamId: row.streamId ?? null,
      toolName: row.toolName ?? null,
      toolPayload: row.toolPayload ? JSON.parse(row.toolPayload) : null,
      error: row.error ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    } as Message,
  }))
}
