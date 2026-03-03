/**
 * code-reader skill — 内置代码阅读与搜索工具集
 *
 * 工具列表：
 *   read_code_file    带行号读取源代码文件
 *   search_in_files   在目录下按关键词/正则搜索
 *   find_files        按文件名/扩展名查找文件
 *
 * 编译方式：tsdown --config tsdown.skills.config.ts
 * 运行环境：worker_threads + vm 沙箱（allowedBuiltins: fs, path）
 */

type FS = typeof import('node:fs')
type PATH = typeof import('node:path')

// ─── 辅助：判断是否为文本文件 ──────────────────────────────────────────────────

const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.jsonc', '.json5',
  '.css', '.scss', '.sass', '.less',
  '.html', '.htm', '.xml', '.svg',
  '.md', '.mdx', '.txt', '.rst',
  '.yaml', '.yml', '.toml', '.ini', '.env',
  '.sh', '.bash', '.zsh', '.fish',
  '.py', '.rb', '.rs', '.go', '.java', '.kt', '.swift',
  '.c', '.cpp', '.h', '.hpp',
  '.cs', '.php', '.lua', '.vim',
  '.graphql', '.gql', '.sql',
  '.Dockerfile', '.dockerignore', '.gitignore', '.gitattributes',
  '.eslintrc', '.prettierrc', '.babelrc', '.editorconfig',
  '.lock', '.prisma',
])

function isTextFile(filePath: string): boolean {
  const path = require('node:path') as PATH
  const ext = path.extname(filePath).toLowerCase()
  return TEXT_EXTENSIONS.has(ext) || !ext // 无扩展名也当文本处理
}

// ─── 工具：带行号读取代码文件 ──────────────────────────────────────────────────

const readCodeFile = {
  name: 'read_code_file',
  description: '读取代码或文本文件，输出带行号的内容。支持读取指定行范围，便于精确引用。',
  schema: {
    file_path: { type: 'string', description: '文件的绝对路径' },
    start_line: { type: 'number', description: '起始行（从 1 开始，默认 1）', optional: true },
    end_line: { type: 'number', description: '结束行（含，默认读到末尾，最多 500 行）', optional: true },
  },
  execute: async ({
    file_path,
    start_line = 1,
    end_line,
  }: {
    file_path: string
    start_line?: number
    end_line?: number
  }) => {
    const fs = require('node:fs') as FS
    const path = require('node:path') as PATH

    const resolved = path.resolve(file_path)

    if (!fs.existsSync(resolved))
      return `文件不存在：${resolved}`

    if (!fs.statSync(resolved).isFile())
      return `路径不是文件：${resolved}`

    if (!isTextFile(resolved))
      return `非文本文件，跳过读取：${resolved}`

    const MAX_BYTES = 512 * 1024
    const stats = fs.statSync(resolved)
    if (stats.size > MAX_BYTES)
      return `文件过大（${Math.round(stats.size / 1024)}KB），超过 512KB 限制。请缩小读取范围。`

    const content = fs.readFileSync(resolved, 'utf-8')
    const allLines = content.split('\n')
    const total = allLines.length

    const start = Math.max(1, start_line)
    const MAX_LINES = 500
    const end = end_line
      ? Math.min(end_line, total, start + MAX_LINES - 1)
      : Math.min(total, start + MAX_LINES - 1)

    if (start > total)
      return `起始行 ${start} 超出文件总行数 ${total}`

    const padLen = String(end).length
    const numbered = allLines
      .slice(start - 1, end)
      .map((line, idx) => {
        const lineNum = String(start + idx).padStart(padLen, ' ')
        return `${lineNum} │ ${line}`
      })
      .join('\n')

    const header = `文件：${resolved}\n行数：${start}-${end} / ${total} 行\n${'─'.repeat(40)}\n`
    const footer = end < total ? `\n${'─'.repeat(40)}\n[${total - end} 行未显示，使用 start_line/end_line 参数继续读取]` : ''

    return header + numbered + footer
  },
}

// ─── 工具：在目录中搜索文本 ────────────────────────────────────────────────────

const searchInFiles = {
  name: 'search_in_files',
  description: '在目录下递归搜索包含指定关键词或正则表达式的文件行，类似 grep。每次最多返回 100 条匹配。',
  schema: {
    dir_path: { type: 'string', description: '搜索的根目录绝对路径' },
    pattern: { type: 'string', description: '搜索的关键词或正则表达式字符串' },
    file_pattern: { type: 'string', description: '限定搜索的文件扩展名，如 ".ts" 或 ".py"（可选）', optional: true },
    is_regex: { type: 'boolean', description: '是否将 pattern 当作正则表达式处理（默认 false）', optional: true },
    case_sensitive: { type: 'boolean', description: '是否区分大小写（默认 false）', optional: true },
    max_results: { type: 'number', description: '最大返回条数（1-200，默认 100）', optional: true },
  },
  execute: async ({
    dir_path,
    pattern,
    file_pattern,
    is_regex = false,
    case_sensitive = false,
    max_results = 100,
  }: {
    dir_path: string
    pattern: string
    file_pattern?: string
    is_regex?: boolean
    case_sensitive?: boolean
    max_results?: number
  }) => {
    const fs = require('node:fs') as FS
    const path = require('node:path') as PATH

    const resolved = path.resolve(dir_path)

    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory())
      return `目录不存在：${resolved}`

    const limit = Math.min(Math.max(1, max_results), 200)

    let regex: RegExp
    try {
      const flags = case_sensitive ? 'g' : 'gi'
      regex = is_regex ? new RegExp(pattern, flags) : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags)
    }
    catch (e: any) {
      return `正则表达式无效：${e.message}`
    }

    const results: string[] = []
    const IGNORED_DIRS = new Set(['.git', 'node_modules', '.holix', 'dist', 'build', '.next', 'out', 'coverage'])

    function walk(dirPath: string): void {
      if (results.length >= limit)
        return

      let entries: import('node:fs').Dirent[]
      try {
        entries = fs.readdirSync(dirPath, { withFileTypes: true })
      }
      catch {
        return
      }

      for (const entry of entries) {
        if (results.length >= limit)
          break

        if (entry.name.startsWith('.') && entry.isDirectory())
          continue

        const fullPath = path.join(dirPath, entry.name)

        if (entry.isDirectory()) {
          if (!IGNORED_DIRS.has(entry.name))
            walk(fullPath)
          continue
        }

        if (!entry.isFile())
          continue

        // 扩展名过滤
        if (file_pattern && !fullPath.endsWith(file_pattern))
          continue

        if (!isTextFile(fullPath))
          continue

        const fileSize = fs.statSync(fullPath).size
        if (fileSize > 1024 * 1024)
          continue // 跳过超过 1MB 的文件

        let content: string
        try {
          content = fs.readFileSync(fullPath, 'utf-8')
        }
        catch {
          continue
        }

        const lines = content.split('\n')
        const relPath = path.relative(resolved, fullPath)

        for (let i = 0; i < lines.length && results.length < limit; i++) {
          regex.lastIndex = 0
          if (regex.test(lines[i])) {
            const lineNum = String(i + 1).padStart(4, ' ')
            results.push(`${relPath}:${lineNum} │ ${lines[i].trimEnd()}`)
          }
        }
      }
    }

    walk(resolved)

    if (results.length === 0)
      return `未找到匹配 "${pattern}" 的内容（搜索范围：${resolved}）`

    const header = `在 ${resolved} 中搜索 "${pattern}"：\n找到 ${results.length} 条${results.length >= limit ? `（已达上限 ${limit}，可能有更多）` : ''}匹配\n${'─'.repeat(40)}\n`
    return header + results.join('\n')
  },
}

// ─── 工具：查找文件 ────────────────────────────────────────────────────────────

const findFiles = {
  name: 'find_files',
  description: '在目录下递归查找匹配名称或扩展名的文件，类似 find 命令。最多返回 200 个结果。',
  schema: {
    dir_path: { type: 'string', description: '搜索的根目录绝对路径' },
    name_pattern: { type: 'string', description: '文件名关键词（模糊匹配）或扩展名如 ".ts"，也可以是完整文件名' },
    max_depth: { type: 'number', description: '最大搜索深度（1-10，默认 6）', optional: true },
    include_dirs: { type: 'boolean', description: '是否同时匹配目录名（默认 false，只匹配文件）', optional: true },
  },
  execute: async ({
    dir_path,
    name_pattern,
    max_depth = 6,
    include_dirs = false,
  }: {
    dir_path: string
    name_pattern: string
    max_depth?: number
    include_dirs?: boolean
  }) => {
    const fs = require('node:fs') as FS
    const path = require('node:path') as PATH

    const resolved = path.resolve(dir_path)

    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory())
      return `目录不存在：${resolved}`

    const depth = Math.min(Math.max(1, max_depth), 10)
    const MAX_RESULTS = 200
    const results: string[] = []
    const lowerPattern = name_pattern.toLowerCase()
    const IGNORED_DIRS = new Set(['.git', 'node_modules', '.holix', 'dist', 'build', '.next', 'out', 'coverage'])

    function walk(dirPath: string, currentDepth: number): void {
      if (currentDepth > depth || results.length >= MAX_RESULTS)
        return

      let entries: import('node:fs').Dirent[]
      try {
        entries = fs.readdirSync(dirPath, { withFileTypes: true })
      }
      catch {
        return
      }

      for (const entry of entries) {
        if (results.length >= MAX_RESULTS)
          break

        const fullPath = path.join(dirPath, entry.name)
        const relPath = path.relative(resolved, fullPath)
        const lowerName = entry.name.toLowerCase()

        // 匹配逻辑：支持扩展名精确匹配或名称包含匹配
        const matches = lowerPattern.startsWith('.')
          ? lowerName.endsWith(lowerPattern) // 扩展名匹配
          : lowerName.includes(lowerPattern) // 名称包含匹配

        if (entry.isFile() && matches) {
          const size = fs.statSync(fullPath).size
          const sizeStr = size < 1024 ? `${size}B` : size < 1024 * 1024 ? `${Math.round(size / 1024)}KB` : `${(size / 1024 / 1024).toFixed(1)}MB`
          results.push(`📄  ${relPath}  (${sizeStr})`)
        }

        if (include_dirs && entry.isDirectory() && matches)
          results.push(`📁  ${relPath}/`)

        if (entry.isDirectory() && !IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.'))
          walk(fullPath, currentDepth + 1)
      }
    }

    walk(resolved, 1)

    if (results.length === 0)
      return `未找到匹配 "${name_pattern}" 的${include_dirs ? '文件或目录' : '文件'}（搜索范围：${resolved}，深度 ${depth}）`

    const header = `在 ${resolved} 中查找 "${name_pattern}"：\n找到 ${results.length} 个${results.length >= MAX_RESULTS ? `（已达上限 ${MAX_RESULTS}）` : ''}结果\n${'─'.repeat(40)}\n`
    return header + results.join('\n')
  },
}

// ─── 导出 ──────────────────────────────────────────────────────────────────────

export default [
  readCodeFile,
  searchInFiles,
  findFiles,
]
