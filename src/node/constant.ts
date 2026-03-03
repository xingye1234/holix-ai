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

/**
 * 内置 skills 目录（纯 JS，无需编译）
 * - 开发：<项目根>/skills/（直接扫描源码目录）
 * - 打包：<resourcesPath>/builtin-skills/（electron-builder extraFiles 复制）
 */
export const BUILTIN_SKILLS_PATH = app.isPackaged
  ? join(process.resourcesPath, 'builtin-skills')
  : join(process.cwd(), 'skills')
