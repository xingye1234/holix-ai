import { resolve } from 'node:path'
import process from 'node:process'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { drizzle } from 'drizzle-orm/libsql/sqlite3'
import { app } from 'electron'
import { databaseUrl } from '../constant'

const promiser = Promise.withResolvers<void>()

export const db = drizzle({
  connection: databaseUrl,
})

let hasMigrated = false
export async function migrateDb() {
  if (hasMigrated) {
    return
  }
  const dir = resolve(app.isPackaged ? process.resourcesPath : process.cwd(), 'drizzle')
  try {
    await migrate(db, { migrationsFolder: dir })
    hasMigrated = true
    promiser.resolve()
  }
  catch (err) {
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
