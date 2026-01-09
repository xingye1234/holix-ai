import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { app } from 'electron'
import { normalize } from 'pathe'

export const userDataDir = join(app.isPackaged ? app.getPath('home') : process.cwd(), '.holixai')

if (!existsSync(userDataDir)) {
  mkdirSync(userDataDir, { recursive: true })
}

export const APP_DATA_PATH = userDataDir
export const databaseUrl = `file:///${normalize(join(userDataDir, './sqlite.db'))}`
export const SCHEME = 'holix'
