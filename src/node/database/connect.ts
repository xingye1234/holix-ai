/* eslint-disable ts/no-require-imports */
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { app } from 'electron'
import { databaseUrl } from '../constant'
import { logger } from '../platform/logger'

// eslint-disable-next-line perfectionist/sort-imports
const Database: typeof import('better-sqlite3') = require('better-sqlite3')

const promiser = Promise.withResolvers<void>()

let unpacked = null
if (import.meta.env.PROD) {
  unpacked = join(
    process.resourcesPath,
    'app.asar.unpacked',
    'node_modules',
    'better-sqlite3',
    'build/Release/better_sqlite3.node',
  )
  process.env.BETTER_SQLITE3_NODE_BINARY = unpacked

  logger.info(`[Database] Setting better-sqlite3 binary path to: ${unpacked}`)

  if (!existsSync(unpacked)) {
    logger.error(`[Database] better-sqlite3 binary not found at path: ${unpacked}`)
  }
}

// better-sqlite3 需要传递数据库文件路径
const dbPath = databaseUrl // 确保 databaseUrl 是本地 sqlite 文件路径

logger.info(`[Database] Using database file at path: ${dbPath}`)

export const sqlite: ReturnType<typeof Database> = new Database(fileURLToPath(dbPath), unpacked
  ? {
      nativeBinding: unpacked || undefined,
    }
  : undefined)

export const db = drizzle(sqlite)

logger.info(`Connected to SQLite database at ${dbPath}`)

let hasMigrated = false

/**
 * 确保 message_fts 是 FTS5 虚拟表
 * Drizzle ORM 不支持 CREATE VIRTUAL TABLE，迁移文件只能生成普通表。
 * 此函数在迁移后检查，若 message_fts 不是虚拟表则重建为 FTS5 虚拟表。
 */
function ensureMessageFtsVirtualTable() {
  // 查询 sqlite_master 判断 message_fts 是否已是虚拟表
  const row = sqlite.prepare(
    `SELECT type, sql FROM sqlite_master WHERE name = 'message_fts'`,
  ).get() as { type: string, sql: string } | undefined

  const isVirtual = row?.sql?.toUpperCase().includes('VIRTUAL')

  if (!isVirtual) {
    logger.info('[Database] message_fts is not a FTS5 virtual table, recreating...')
    sqlite.exec(`DROP TABLE IF EXISTS message_fts`)
    sqlite.exec(`
      CREATE VIRTUAL TABLE message_fts USING fts5(
        uid UNINDEXED,
        chat_uid UNINDEXED,
        content,
        tokenize = 'unicode61'
      )
    `)
    logger.info('[Database] message_fts FTS5 virtual table created successfully.')
    // 从 message 表中重建 FTS 索引（存量数据迁移）
    rebuildMessageFtsIndex()
  }
  else {
    logger.info('[Database] message_fts is already a FTS5 virtual table.')
  }
}

/**
 * 从 message 表全量重建 FTS 索引
 * 在 FTS 表首次创建或需要重新索引时调用
 */
function rebuildMessageFtsIndex() {
  logger.info('[Database] Rebuilding message_fts index from existing messages...')
  sqlite.exec(`DELETE FROM message_fts`)
  sqlite.exec(`
    INSERT INTO message_fts (uid, chat_uid, content)
    SELECT uid, chat_uid, content
    FROM message
    WHERE searchable = 1 AND content IS NOT NULL AND content != ''
  `)
  const count = (sqlite.prepare(`SELECT count(*) AS cnt FROM message_fts`).get() as any).cnt
  logger.info(`[Database] message_fts index rebuilt, total ${count} rows.`)
}

export async function migrateDb() {
  logger.info('Starting database migration process...')
  if (hasMigrated) {
    logger.info('Database has already been migrated. Skipping migration.')
    return
  }
  const dir = resolve(app.isPackaged ? process.resourcesPath : process.cwd(), 'drizzle')
  try {
    logger.info('Applying database migrations...')
    migrate(db, { migrationsFolder: dir })
    logger.info('Database migrations applied successfully.')

    // Drizzle ORM 不支持通过 schema 声明 FTS5 虚拟表
    // 在迁移完成后手动确保 message_fts 是真正的 FTS5 虚拟表
    ensureMessageFtsVirtualTable()

    hasMigrated = true
    promiser.resolve()
  }
  catch (err) {
    logger.error('Error applying database migrations:', err)
    promiser.reject(err)
    throw err
  }
}

export async function waitForDbMigrations() {
  return promiser.promise
}

export async function getDatabase() {
  await waitForDbMigrations()
  return db
}
