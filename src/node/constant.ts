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
 * 内置 skills 编译产物目录（tsdown.skills.config.ts 的输出位置）
 * - 开发：<项目根>/.holix/builtin-skills/
 * - 打包：app.asar 内同路径（electron-builder files 已包含 .holix/**/*）
 */
export const BUILTIN_SKILLS_PATH = join(app.getAppPath(), '.holix', 'builtin-skills')
