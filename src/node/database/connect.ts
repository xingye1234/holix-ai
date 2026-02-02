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
const Database = require('better-sqlite3')

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

const sqlite = new Database(fileURLToPath(dbPath), unpacked
  ? {
      nativeBinding: unpacked || undefined,
    }
  : undefined)

export const db = drizzle(sqlite)

logger.info(`Connected to SQLite database at ${dbPath}`)

let hasMigrated = false
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
