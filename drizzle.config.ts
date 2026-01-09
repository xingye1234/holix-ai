import { existsSync, mkdirSync } from 'node:fs'
import { defineConfig } from 'drizzle-kit'

const userDataDir = existsSync('.holixai') ? '.holixai' : './.holixai'

if (!existsSync(userDataDir)) {
  mkdirSync(userDataDir, { recursive: true })
}

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/node/database/schema',
  dbCredentials: {
    url: './.holixai/sqlite.db', // 这里是关键，指定 SQLite 数据库文件路径
  },
})
