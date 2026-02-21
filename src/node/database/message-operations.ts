import type { DraftContent, Message, MessageInsert } from './schema/chat'
import { and, desc, eq, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { logger } from '../platform/logger'
import { updateChatLastSeq } from './chat-operations'
import { getDatabase, sqlite } from './connect'
import {
  message,
} from './schema/chat'

// FTS 同步辅助函数（使用 raw sqlite，因为 message_fts 是 FTS5 虚拟表，Drizzle 无法操作）
function ftsSyncInsert(uid: string, chatUid: string, content: string) {
  try {
    sqlite.prepare(`INSERT OR REPLACE INTO message_fts (uid, chat_uid, content) VALUES (?, ?, ?)`).run(uid, chatUid, content)
  }
  catch (e) {
    logger.warn('[FTS] insert failed:', e)
  }
}

function ftsSyncUpdate(uid: string, content: string) {
  try {
    sqlite.prepare(`UPDATE message_fts SET content = ? WHERE uid = ?`).run(content, uid)
  }
  catch (e) {
    logger.warn('[FTS] update failed:', e)
  }
}

function ftsSyncDelete(uid: string) {
  try {
    sqlite.prepare(`DELETE FROM message_fts WHERE uid = ?`).run(uid)
  }
  catch (e) {
    logger.warn('[FTS] delete failed:', e)
  }
}

function ftsSyncDeleteByChatUid(chatUid: string) {
  try {
    sqlite.prepare(`DELETE FROM message_fts WHERE chat_uid = ?`).run(chatUid)
  }
  catch (e) {
    logger.warn('[FTS] deleteByChat failed:', e)
  }
}

/**
 * 反序列化消息中的 JSON 字段
 * @param msg - 数据库查询出的消息对象
 * @returns 反序列化后的消息对象
 */
function deserializeMessage(msg: Message): Message {
  if (!msg)
    return msg

  const deserialized = { ...msg }

  // 反序列化 draftContent
  if (msg.draftContent && typeof msg.draftContent === 'string') {
    try {
      (deserialized as any).draftContent = JSON.parse(msg.draftContent)
    }
    catch (error) {
      console.error('Failed to parse draftContent:', error);
      (deserialized as any).draftContent = null
    }
  }

  // 反序列化 toolPayload
  if (msg.toolPayload && typeof msg.toolPayload === 'string') {
    try {
      (deserialized as any).toolPayload = JSON.parse(msg.toolPayload)
    }
    catch (error) {
      console.error('Failed to parse toolPayload:', error);
      (deserialized as any).toolPayload = null
    }
  }

  return deserialized
}

/**
 * 创建新消息
 * @param params - 创建参数
 * @returns 创建的消息记录
 */
export async function createMessage(params: {
  chatUid: string
  seq: number
  role: 'user' | 'assistant' | 'system' | 'tool'
  kind: string
  content?: string
  draftContent?: DraftContent
  status?: 'pending' | 'streaming' | 'done' | 'aborted' | 'error'
  model?: string
  parentUid?: string
  requestId?: string
  streamId?: string
  toolName?: string
  toolPayload?: Record<string, any>
}): Promise<Message> {
  const db = await getDatabase()
  const uid = nanoid()
  const now = Date.now()

  const insert: MessageInsert = {
    uid,
    chatUid: params.chatUid,
    seq: params.seq,
    role: params.role,
    kind: params.kind,
    content: params.content || null,
    draftContent: params.draftContent
      ? (JSON.stringify(params.draftContent) as any)
      : null,
    status: params.status || 'done',
    model: params.model || null,
    searchable: true,
    searchIndexVersion: null,
    parentUid: params.parentUid || null,
    requestId: params.requestId || null,
    streamId: params.streamId || null,
    toolName: params.toolName || null,
    toolPayload: params.toolPayload
      ? (JSON.stringify(params.toolPayload) as any)
      : null,
    error: null,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(message).values(insert)

  // 同步写入 FTS 索引
  if (insert.content && insert.searchable) {
    ftsSyncInsert(insert.uid, insert.chatUid, insert.content)
  }

  // 更新会话的最后序号
  await updateChatLastSeq(params.chatUid, params.seq)

  const [msg] = await db.select().from(message).where(eq(message.uid, uid))
  return deserializeMessage(msg)
}

/**
 * 创建用户消息（便捷方法）
 * @param chatUid - 会话 UID
 * @param content - 消息内容
 * @returns 创建的用户消息记录
 */
export async function createUserMessage(
  chatUid: string,
  content: string,
): Promise<Message> {
  // 获取下一个序号
  const seq = await getNextSeq(chatUid)

  return await createMessage({
    chatUid,
    seq,
    role: 'user',
    kind: 'message',
    content,
    status: 'done',
  })
}

/**
 * 获取消息详情
 * @param messageUid - 消息 UID
 * @returns 消息记录，不存在则返回 null
 */
export async function getMessageByUid(
  messageUid: string,
): Promise<Message | null> {
  const db = await getDatabase()
  const [msg] = await db
    .select()
    .from(message)
    .where(eq(message.uid, messageUid))
  return msg ? deserializeMessage(msg) : null
}

/**
 * 获取会话的所有消息
 * @param chatUid - 会话 UID
 * @param options - 查询选项
 * @param options.beforeSeq - 查询小于等于此 seq 的消息（用于向前加载）
 * @param options.limit - 限制数量，默认 200
 * @param options.order - 排序方式，默认 desc（最新的在前）
 * @returns 消息列表
 */
export async function getMessagesByChatUid(
  chatUid: string,
  options?: {
    beforeSeq?: number
    limit?: number
    order?: 'asc' | 'desc'
  },
): Promise<Message[]> {
  const db = await getDatabase()

  // 基础条件
  const conditions = [eq(message.chatUid, chatUid)]

  // 如果指定了 beforeSeq，则查询小于等于该 seq 的消息
  if (options?.beforeSeq !== undefined) {
    conditions.push(sql`${message.seq} <= ${options.beforeSeq}`)
  }

  let query = db.select().from(message).where(and(...conditions))

  // 排序：默认降序（最新的在前）
  const order = options?.order || 'desc'
  if (order === 'desc') {
    query = query.orderBy(desc(message.seq)) as any
  }
  else {
    query = query.orderBy(message.seq) as any
  }

  // 限制数量：默认 200
  const limit = options?.limit || 200
  query = query.limit(limit) as any

  const messages = await query
  return messages.map(deserializeMessage)
}

/**
 * 获取会话的最新 N 条消息
 * @param chatUid - 会话 UID
 * @param limit - 数量限制
 * @returns 消息列表（按时间升序）
 */
export async function getLatestMessages(
  chatUid: string,
  limit: number,
): Promise<Message[]> {
  const messages = await getMessagesByChatUid(chatUid, {
    limit,
    order: 'desc',
  })
  return messages.reverse() // 反转为升序
}

/**
 * 更新消息内容
 * @param messageUid - 消息 UID
 * @param content - 新内容
 */
export async function updateMessageContent(
  messageUid: string,
  content: string,
): Promise<void> {
  const db = await getDatabase()
  await db
    .update(message)
    .set({
      content,
      updatedAt: Date.now(),
    })
    .where(eq(message.uid, messageUid))

  ftsSyncUpdate(messageUid, content)
}

/**
 * 更新消息的草稿内容
 * @param messageUid - 消息 UID
 * @param draftContent - 草稿内容
 */
export async function updateMessageDraftContent(
  messageUid: string,
  draftContent: DraftContent,
): Promise<void> {
  const db = await getDatabase()
  await db
    .update(message)
    .set({
      draftContent: JSON.stringify(draftContent) as any,
      updatedAt: Date.now(),
    })
    .where(eq(message.uid, messageUid))
}

/**
 * 更新消息状态
 * @param messageUid - 消息 UID
 * @param status - 新状态
 */
export async function updateMessageStatus(
  messageUid: string,
  status: 'pending' | 'streaming' | 'done' | 'aborted' | 'error',
): Promise<void> {
  const db = await getDatabase()
  await db
    .update(message)
    .set({
      status,
      updatedAt: Date.now(),
    })
    .where(eq(message.uid, messageUid))
}

/**
 * 设置消息错误
 * @param messageUid - 消息 UID
 * @param error - 错误信息
 */
export async function setMessageError(
  messageUid: string,
  error: string,
): Promise<void> {
  const db = await getDatabase()
  await db
    .update(message)
    .set({
      error,
      status: 'error',
      updatedAt: Date.now(),
    })
    .where(eq(message.uid, messageUid))
}

/**
 * 删除消息
 * @param messageUid - 消息 UID
 */
export async function deleteMessage(messageUid: string): Promise<void> {
  const db = await getDatabase()
  await db.delete(message).where(eq(message.uid, messageUid))
  ftsSyncDelete(messageUid)
}

/**
 * 删除会话的所有消息
 * @param chatUid - 会话 UID
 */
export async function deleteMessagesByChatUid(chatUid: string): Promise<void> {
  const db = await getDatabase()
  await db.delete(message).where(eq(message.chatUid, chatUid))
  ftsSyncDeleteByChatUid(chatUid)
}

/**
 * 批量更新消息（通用方法）
 * @param messageUid - 消息 UID
 * @param updates - 要更新的字段
 */
export async function updateMessage(
  messageUid: string,
  updates: Partial<Omit<Message, 'id' | 'uid' | 'chatUid' | 'seq'>>,
): Promise<void> {
  const db = await getDatabase()

  // 序列化 draftContent 和 toolPayload
  const serializedUpdates = { ...updates }
  if ('draftContent' in updates && updates.draftContent !== undefined && updates.draftContent !== null) {
    (serializedUpdates as any).draftContent = JSON.stringify(updates.draftContent)
  }
  if ('toolPayload' in updates && updates.toolPayload !== undefined && updates.toolPayload !== null) {
    (serializedUpdates as any).toolPayload = JSON.stringify(updates.toolPayload)
  }

  await db
    .update(message)
    .set({
      ...serializedUpdates,
      updatedAt: Date.now(),
    })
    .where(eq(message.uid, messageUid))

  // 若更新了 content，同步 FTS 索引
  if ('content' in updates) {
    if (updates.content) {
      ftsSyncUpdate(messageUid, updates.content)
    }
    else {
      ftsSyncDelete(messageUid)
    }
  }
}

/**
 * 获取会话的下一个序号
 * @param chatUid - 会话 UID
 * @returns 下一个可用的序号
 */
export async function getNextSeq(chatUid: string): Promise<number> {
  const db = await getDatabase()
  const [result] = await db
    .select({ maxSeq: message.seq })
    .from(message)
    .where(eq(message.chatUid, chatUid))
    .orderBy(desc(message.seq))
    .limit(1)

  return result ? result.maxSeq + 1 : 1
}

/**
 * 提交草稿内容到正式内容
 * @param messageUid - 消息 UID
 */
export async function commitDraftContent(messageUid: string): Promise<void> {
  const db = await getDatabase()
  const [msg] = await db
    .select()
    .from(message)
    .where(eq(message.uid, messageUid))

  if (!msg || !msg.draftContent) {
    return
  }

  // 反序列化 draftContent
  const deserializedMsg = deserializeMessage(msg)
  if (!deserializedMsg.draftContent) {
    return
  }

  // 将草稿内容合并为最终内容
  const content = deserializedMsg.draftContent.map(segment => segment.content).join('')

  await db
    .update(message)
    .set({
      content,
      status: 'done',
      updatedAt: Date.now(),
    })
    .where(eq(message.uid, messageUid))

  if (content && deserializedMsg.searchable) {
    ftsSyncUpdate(messageUid, content)
  }
}

/**
 * 获取特定请求的所有消息
 * @param requestId - 请求 ID
 * @returns 消息列表
 */
export async function getMessagesByRequestId(
  requestId: string,
): Promise<Message[]> {
  const db = await getDatabase()
  const messages = await db
    .select()
    .from(message)
    .where(eq(message.requestId, requestId))
    .orderBy(message.seq)
  return messages.map(deserializeMessage)
}

/**
 * 获取特定流的消息
 * @param streamId - 流 ID
 * @returns 消息记录，不存在则返回 null
 */
export async function getMessageByStreamId(
  streamId: string,
): Promise<Message | null> {
  const db = await getDatabase()
  const [msg] = await db
    .select()
    .from(message)
    .where(eq(message.streamId, streamId))
  return msg ? deserializeMessage(msg) : null
}
