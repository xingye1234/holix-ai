/**
 * Chat Operations
 * 提供 Chat 表的核心操作方法
 */

import type { Chat, ChatInsert, PendingMessage } from './schema/chat'

import { eq, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { getDatabase, sqlite } from './connect'
import { chats, message } from './schema/chat'

/**
 * 创建新会话
 * @param params - 创建参数
 * @param params.provider - 提供方 (openai/anthropic/gemini/ollama)
 * @param params.model - 模型名称
 * @param params.title - 会话标题
 * @returns 创建的会话记录
 */
export async function createChat(params: {
  provider: string
  model: string
  title: string
}): Promise<Chat> {
  const db = await getDatabase()
  const uid = nanoid()
  const now = Date.now()

  const insert: ChatInsert = {
    uid,
    title: params.title,
    provider: params.provider,
    model: params.model,
    status: 'active',
    pinned: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
    lastSeq: 0,
    lastMessagePreview: null,
    pendingMessages: null,
    prompts: JSON.stringify([]) as any,
    workspace: null,
  }

  await db.insert(chats).values(insert)

  const [chat] = await db.select().from(chats).where(eq(chats.uid, uid))
  return chat
}

/**
 * 修改会话的模型名称
 * @param chatUid - 会话 UID
 * @param model - 新的模型名称
 */
export async function updateChatModel(
  chatUid: string,
  model: string,
): Promise<void> {
  const db = await getDatabase()
  await db
    .update(chats)
    .set({
      model,
      updatedAt: Date.now(),
    })
    .where(eq(chats.uid, chatUid))
}

/**
 * 更新会话信息（通用方法）
 * @param chatUid - 会话 UID
 * @param updates - 要更新的字段
 */
export async function updateChat(
  chatUid: string,
  updates: Partial<Pick<Chat, 'provider' | 'model' | 'title' | 'status' | 'pinned' | 'archived'>>,
): Promise<Chat> {
  const db = await getDatabase()
  await db
    .update(chats)
    .set({
      ...updates,
      updatedAt: Date.now(),
    })
    .where(eq(chats.uid, chatUid))

  const [chat] = await db.select().from(chats).where(eq(chats.uid, chatUid))
  return chat
}

/**
 * 修改会话的最后消息预览
 * @param chatUid - 会话 UID
 * @param preview - 预览文本
 */
export async function updateLastMessagePreview(
  chatUid: string,
  preview: string | null,
): Promise<void> {
  const db = await getDatabase()
  await db
    .update(chats)
    .set({
      lastMessagePreview: preview,
      updatedAt: Date.now(),
    })
    .where(eq(chats.uid, chatUid))
}

/**
 * 修改会话标题
 * @param chatUid - 会话 UID
 * @param title - 新标题
 */
export async function updateChatTitle(
  chatUid: string,
  title: string,
): Promise<void> {
  const db = await getDatabase()
  await db
    .update(chats)
    .set({
      title,
      updatedAt: Date.now(),
    })
    .where(eq(chats.uid, chatUid))
}

/**
 * 获取会话详情
 * @param chatUid - 会话 UID
 * @returns 会话记录，不存在则返回 null
 */
export async function getChatByUid(chatUid: string): Promise<Chat | null> {
  const db = await getDatabase()
  const [chat] = await db.select().from(chats).where(eq(chats.uid, chatUid))
  return chat || null
}

/**
 * 归档会话
 * @param chatUid - 会话 UID
 */
export async function archiveChat(chatUid: string): Promise<void> {
  const db = await getDatabase()
  await db
    .update(chats)
    .set({
      archived: true,
      updatedAt: Date.now(),
    })
    .where(eq(chats.uid, chatUid))
}

/**
 * 取消归档会话
 * @param chatUid - 会话 UID
 */
export async function unarchiveChat(chatUid: string): Promise<void> {
  const db = await getDatabase()
  await db
    .update(chats)
    .set({
      archived: false,
      updatedAt: Date.now(),
    })
    .where(eq(chats.uid, chatUid))
}

/**
 * 置顶/取消置顶会话
 * @param chatUid - 会话 UID
 * @param pinned - 是否置顶
 */
export async function updateChatPinned(
  chatUid: string,
  pinned: boolean,
): Promise<void> {
  const db = await getDatabase()
  await db
    .update(chats)
    .set({
      pinned,
      updatedAt: Date.now(),
    })
    .where(eq(chats.uid, chatUid))
}

/**
 * 删除会话（会级联删除所有消息）
 * @param chatUid - 会话 UID
 */
export async function deleteChat(chatUid: string): Promise<void> {
  const db = await getDatabase()
  // 先清理 FTS 虚拟表（不受外键 CASCADE 影响，需手动删除）
  sqlite.prepare(`DELETE FROM message_fts WHERE chat_uid = ?`).run(chatUid)
  // better-sqlite3 是同步驱动，transaction 回调不可为 async（不能返回 Promise）
  // 需显式调用 .run() 触发执行，否则查询构建器不会真正发出 SQL
  db.transaction((ctx) => {
    ctx.delete(message).where(eq(message.chatUid, chatUid)).run()
    ctx.delete(chats).where(eq(chats.uid, chatUid)).run()
  })
}

/**
 * 更新会话的最后消息序号
 * @param chatUid - 会话 UID
 * @param seq - 新的序号
 */
export async function updateChatLastSeq(
  chatUid: string,
  seq: number,
): Promise<void> {
  const db = await getDatabase()
  await db
    .update(chats)
    .set({
      lastSeq: seq,
      updatedAt: Date.now(),
    })
    .where(eq(chats.uid, chatUid))
}

/**
 * 更新会话的提示词列表
 * @param chatUid - 会话 UID
 * @param prompts - 提示词数组
 */
export async function updateChatPrompts(
  chatUid: string,
  prompts: string[],
): Promise<Chat> {
  const db = await getDatabase()
  await db
    .update(chats)
    .set({
      prompts: JSON.stringify(prompts) as any,
      updatedAt: Date.now(),
    })
    .where(eq(chats.uid, chatUid))

  const [chat] = await db.select().from(chats).where(eq(chats.uid, chatUid))
  return chat
}

/**
 * 更新会话的工作区
 * @param chatUid - 会话 UID
 * @param workspace - 工作区配置数组
 */
export async function updateChatWorkspace(
  chatUid: string,
  workspace: Chat['workspace'],
): Promise<Chat> {
  const db = await getDatabase()
  await db
    .update(chats)
    .set({
      workspace: workspace ? JSON.stringify(workspace) as any : null,
      updatedAt: Date.now(),
    })
    .where(eq(chats.uid, chatUid))

  const [chat] = await db.select().from(chats).where(eq(chats.uid, chatUid))
  return chat
}

/**
 * 更新会话的 pendingMessages（用于本地待发送消息缓存）
 * @param chatUid - 会话 UID
 * @param pendingMessages - 待发送消息数组，传入 null 可清空
 */
export async function updatePendingMessages(
  chatUid: string,
  pendingMessages: PendingMessage[] | null,
): Promise<Chat> {
  const db = await getDatabase()
  await db
    .update(chats)
    .set({
      pendingMessages: pendingMessages ? (JSON.stringify(pendingMessages) as any) : null,
      updatedAt: Date.now(),
    })
    .where(eq(chats.uid, chatUid))

  const [chat] = await db.select().from(chats).where(eq(chats.uid, chatUid))
  return chat
}

/**
 * 查询所有会话
 * @param options - 查询选项
 * @param options.includeArchived - 是否包含已归档的会话，默认为 false
 * @param options.orderBy - 排序方式，默认为 updatedAt 降序
 * @returns 会话列表
 */
export async function getAllChats(options?: {
  includeArchived?: boolean
  orderBy?: 'updatedAt' | 'createdAt' | 'title'
  order?: 'asc' | 'desc'
}): Promise<Chat[]> {
  const db = await getDatabase()

  let query = db.select().from(chats)

  // 默认不包含已归档的会话
  if (!options?.includeArchived) {
    query = query.where(eq(chats.archived, false)) as any
  }

  // 排序
  const orderBy = options?.orderBy || 'updatedAt'
  const order = options?.order || 'desc'

  if (order === 'desc') {
    query = query.orderBy(sql`${chats[orderBy]} DESC`) as any
  }
  else {
    query = query.orderBy(sql`${chats[orderBy]} ASC`) as any
  }

  const result = await query
  return result
}
