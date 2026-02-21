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

  // trigram 分词器：对每3个连续字符建索引，天然支持子串匹配，无需 "word"* 前缀语法
  // 对于 < 3 字符的短查询（如 "ai"、"问题"），trigram 无法产生索引项，需回退到 LIKE 搜索
  const trimmed = query.trim()
  const queryCharLen = [...trimmed.replace(/\s+/g, '')].length
  const isShortQuery = queryCharLen < 3

  let sqlStr: string
  let params: any[]

  if (isShortQuery) {
    // 短查询：对 message 表直接做 LIKE '%keyword%' 全文扫描
    // 对桌面应用的消息量级（万级）性能完全可接受
    const likePattern = `%${trimmed}%`
    if (chatUid) {
      sqlStr = `
        SELECT
          0 AS rank,
          id, uid, seq, chat_uid AS chatUid, role, kind,
          content, draft_content AS draftContent, status, model,
          searchable, search_index_version AS searchIndexVersion,
          parent_uid AS parentUid, request_id AS requestId,
          stream_id AS streamId, tool_name AS toolName,
          tool_payload AS toolPayload, error,
          created_at AS createdAt, updated_at AS updatedAt
        FROM message
        WHERE searchable = 1 AND content IS NOT NULL
          AND LOWER(content) LIKE LOWER(?)
          AND chat_uid = ?
        ORDER BY seq DESC
        LIMIT ? OFFSET ?
      `
      params = [likePattern, chatUid, limit, offset]
    }
    else {
      sqlStr = `
        SELECT
          0 AS rank,
          id, uid, seq, chat_uid AS chatUid, role, kind,
          content, draft_content AS draftContent, status, model,
          searchable, search_index_version AS searchIndexVersion,
          parent_uid AS parentUid, request_id AS requestId,
          stream_id AS streamId, tool_name AS toolName,
          tool_payload AS toolPayload, error,
          created_at AS createdAt, updated_at AS updatedAt
        FROM message
        WHERE searchable = 1 AND content IS NOT NULL
          AND LOWER(content) LIKE LOWER(?)
        ORDER BY seq DESC
        LIMIT ? OFFSET ?
      `
      params = [likePattern, limit, offset]
    }

    const rows = sqlite.prepare(sqlStr).all(...params) as Array<Record<string, any>>
    return rows.map(row => ({
      rank: 0,
      message: mapRow(row),
    }))
  }

  // 长查询（>= 3 字符）：使用 FTS5 trigram MATCH + BM25 排序
  // trigram 直接使用原始查询词，无需加引号或 * 后缀
  const sanitizedQuery = trimmed
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')

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
    message: mapRow(row),
  }))
}

function mapRow(row: Record<string, any>): Message {
  return {
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
  } as Message
}
