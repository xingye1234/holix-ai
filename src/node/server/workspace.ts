import type { Dirent } from 'node:fs'
import type { Workspace } from '../database/schema/chat'
import { readdirSync, statSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { z } from 'zod'
import logger from '@/lib/logger'
import { getChatByUid } from '../database/chat-operations'
import { procedure, router } from './trpc'

// ─── 常量 ──────────────────────────────────────────────────────────────────────

/** 遍历时跳过的目录名 */
const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.output',
  '__pycache__',
  '.venv',
  'venv',
  '.cache',
  '.turbo',
  '.parcel-cache',
  'coverage',
  '.nyc_output',
])

const MAX_DEPTH = 6
const MAX_FILES = 2000

// ─── 类型 ──────────────────────────────────────────────────────────────────────

export interface WorkspaceFileItem {
  /** 文件名（用于 label 显示） */
  label: string
  /** 相对于 workspace 根目录的路径（用于 description） */
  relativePath: string
  /** 完整绝对路径（插入编辑器时使用） */
  path: string
  /** 类型 */
  type: 'file' | 'directory'
  /** 所属 workspace 根目录 */
  workspaceRoot: string
}

// ─── 文件遍历 ──────────────────────────────────────────────────────────────────

function walkDir(
  dir: string,
  root: string,
  results: WorkspaceFileItem[],
  depth: number,
): void {
  if (depth > MAX_DEPTH || results.length >= MAX_FILES)
    return

  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  }
  catch {
    return
  }

  for (const entry of entries) {
    if (results.length >= MAX_FILES)
      break

    if (entry.name.startsWith('.') && entry.name !== '.env')
      continue

    const fullPath = join(dir, entry.name)
    const rel = relative(root, fullPath)

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name))
        continue
      results.push({
        label: entry.name,
        relativePath: rel,
        path: fullPath,
        type: 'directory',
        workspaceRoot: root,
      })
      walkDir(fullPath, root, results, depth + 1)
    }
    else if (entry.isFile()) {
      results.push({
        label: entry.name,
        relativePath: rel,
        path: fullPath,
        type: 'file',
        workspaceRoot: root,
      })
    }
  }
}

/** 收集 workspace 条目中的所有文件 */
function collectFiles(workspaces: Workspace[]): WorkspaceFileItem[] {
  const results: WorkspaceFileItem[] = []

  for (const ws of workspaces) {
    if (results.length >= MAX_FILES)
      break

    try {
      if (ws.type === 'directory') {
        walkDir(ws.value, ws.value, results, 0)
      }
      else {
        // 单文件直接加入
        const stat = statSync(ws.value)
        if (stat.isFile()) {
          results.push({
            label: basename(ws.value),
            relativePath: basename(ws.value),
            path: ws.value,
            type: 'file',
            workspaceRoot: ws.value,
          })
        }
      }
    }
    catch {
      // 路径不可访问时跳过
    }
  }

  return results
}

// ─── 过滤排序 ──────────────────────────────────────────────────────────────────

/**
 * 对文件列表按 query 过滤并排序：
 *   1. 文件名前缀匹配优先
 *   2. 文件名包含匹配次之
 *   3. 相对路径包含匹配最后
 */
function filterFiles(
  files: WorkspaceFileItem[],
  query: string,
  maxResults: number,
): WorkspaceFileItem[] {
  if (!query)
    return files.slice(0, maxResults)

  const q = query.toLowerCase()
  const prefixMatch: WorkspaceFileItem[] = []
  const nameContains: WorkspaceFileItem[] = []
  const pathContains: WorkspaceFileItem[] = []

  for (const f of files) {
    const name = f.label.toLowerCase()
    const rel = f.relativePath.toLowerCase()

    if (name.startsWith(q))
      prefixMatch.push(f)
    else if (name.includes(q))
      nameContains.push(f)
    else if (rel.includes(q))
      pathContains.push(f)
  }

  return [...prefixMatch, ...nameContains, ...pathContains].slice(0, maxResults)
}

// ─── 路由 ──────────────────────────────────────────────────────────────────────

export const workspaceRouter = router({
  /**
   * 查询当前 chat workspace 下的文件，供编辑器 `#` 智能提示使用。
   *
   * @param chatUid   - 当前会话 ID
   * @param query     - 用户输入的过滤字符串（文件名模糊匹配）
   * @param maxResults - 最多返回条数，默认 50
   * @param onlyFiles  - true 时只返回文件（不含目录），默认 false
   */
  queryFiles: procedure()
    .input(
      z.object({
        chatUid: z.string(),
        query: z.string().default(''),
        maxResults: z.number().int().min(1).max(200).default(50),
        onlyFiles: z.boolean().optional().default(false),
      }),
    )
    .query(async ({ input }) => {
      const chat = await getChatByUid(input.chatUid)
      if (!chat || !chat.workspace)
        return { items: [] }

      const workspaces = chat.workspace

      logger.info(`[workspace] queryFiles: chatUid=${input.chatUid}, query="${input.query}", maxResults=${input.maxResults}, onlyFiles=${input.onlyFiles} => total workspace files=${workspaces.length}`)

      if (!Array.isArray(workspaces) || workspaces.length === 0)
        return { items: [] }

      let files = collectFiles(workspaces)

      if (input.onlyFiles) {
        files = files.filter(f => f.type === 'file')
      }

      const items = filterFiles(files, input.query, input.maxResults)

      logger.info(`[workspace] queryFiles: chatUid=${input.chatUid}, query="${input.query}", maxResults=${input.maxResults}, onlyFiles=${input.onlyFiles} => returned ${items.length} items`)

      return { items }
    }),
})
