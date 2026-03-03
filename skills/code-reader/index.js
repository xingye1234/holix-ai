'use strict'

/**
 * code-reader — 内置代码阅读与搜索工具集
 *
 * 工具列表：
 *   read_code_file    带行号读取源码（支持行范围，最多 500 行）
 *   search_in_files   目录下全文搜索（关键词 / 正则，类 grep）
 *   find_files        按文件名 / 扩展名查找文件
 */

const fs = require('node:fs')
const path = require('node:path')

// ─── helpers ──────────────────────────────────────────────────────────────────

const TEXT_EXTS = new Set([
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
  '.graphql', '.gql', '.sql', '.prisma',
  '.Dockerfile', '.dockerignore', '.gitignore', '.gitattributes',
  '.eslintrc', '.prettierrc', '.babelrc', '.editorconfig', '.lock',
])

const IGNORED_DIRS = new Set(['.git', 'node_modules', '.holix', 'dist', 'build', '.next', 'out', 'coverage', '.cache'])

function isText(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  return TEXT_EXTS.has(ext) || !ext
}

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

// ─── read_code_file ───────────────────────────────────────────────────────────

const readCodeFile = {
  name: 'read_code_file',
  description: '读取代码或文本文件，输出带行号的内容。支持指定行范围，最多返回 500 行。',
  schema: {
    file_path: { type: 'string', description: '文件的绝对路径' },
    start_line: { type: 'number', description: '起始行（从 1 开始，默认 1）', optional: true },
    end_line: { type: 'number', description: '结束行（含，默认至末尾，最多 500 行）', optional: true },
  },
  execute: async ({ file_path, start_line = 1, end_line }) => {
    const resolved = path.resolve(file_path)

    if (!fs.existsSync(resolved)) return `文件不存在：${resolved}`
    const stat = fs.statSync(resolved)
    if (!stat.isFile()) return `路径不是文件：${resolved}`
    if (!isText(resolved)) return `非文本文件，跳过：${resolved}`
    if (stat.size > 512 * 1024) return `文件过大（${fmtSize(stat.size)}），超过 512KB 限制。请缩小行范围重试。`

    const lines = fs.readFileSync(resolved, 'utf-8').split('\n')
    const total = lines.length
    const start = Math.max(1, start_line)
    const MAX_LINES = 500
    const end = end_line
      ? Math.min(end_line, total, start + MAX_LINES - 1)
      : Math.min(total, start + MAX_LINES - 1)

    if (start > total) return `起始行 ${start} 超出文件总行数 ${total}`

    const padLen = String(end).length
    const numbered = lines
      .slice(start - 1, end)
      .map((line, i) => `${String(start + i).padStart(padLen, ' ')} │ ${line}`)
      .join('\n')

    const header = `文件：${resolved}\n行数：${start}-${end} / ${total}\n${'─'.repeat(40)}\n`
    const footer = end < total
      ? `\n${'─'.repeat(40)}\n[还有 ${total - end} 行，用 start_line/end_line 继续读取]`
      : ''

    return header + numbered + footer
  },
}

// ─── search_in_files ──────────────────────────────────────────────────────────

const searchInFiles = {
  name: 'search_in_files',
  description: '在目录下递归搜索包含指定关键词或正则的行（类 grep），最多返回 100 条。',
  schema: {
    dir_path: { type: 'string', description: '搜索的根目录绝对路径' },
    pattern: { type: 'string', description: '要搜索的关键词或正则表达式' },
    file_ext: { type: 'string', description: '限定扩展名，如 ".ts"（可选）', optional: true },
    is_regex: { type: 'boolean', description: '是否将 pattern 当正则处理（默认 false）', optional: true },
    case_sensitive: { type: 'boolean', description: '区分大小写（默认 false）', optional: true },
    max_results: { type: 'number', description: '最大返回条数（1-200，默认 100）', optional: true },
  },
  execute: async ({ dir_path, pattern, file_ext, is_regex = false, case_sensitive = false, max_results = 100 }) => {
    const resolved = path.resolve(dir_path)
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory())
      return `目录不存在：${resolved}`

    const limit = Math.min(Math.max(1, max_results), 200)
    const flags = case_sensitive ? 'g' : 'gi'
    let regex
    try {
      regex = is_regex
        ? new RegExp(pattern, flags)
        : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags)
    } catch (e) {
      return `正则无效：${e.message}`
    }

    const results = []

    function walk(dir) {
      if (results.length >= limit) return
      let entries
      try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }

      for (const e of entries) {
        if (results.length >= limit) break
        if (e.name.startsWith('.') && e.isDirectory()) continue
        const full = path.join(dir, e.name)

        if (e.isDirectory()) {
          if (!IGNORED_DIRS.has(e.name)) walk(full)
          continue
        }
        if (!e.isFile()) continue
        if (file_ext && !full.endsWith(file_ext)) continue
        if (!isText(full)) continue
        if (fs.statSync(full).size > 1024 * 1024) continue

        let content
        try { content = fs.readFileSync(full, 'utf-8') } catch { continue }

        const rel = path.relative(resolved, full)
        content.split('\n').forEach((line, i) => {
          if (results.length >= limit) return
          regex.lastIndex = 0
          if (regex.test(line)) {
            results.push(`${rel}:${String(i + 1).padStart(4, ' ')} │ ${line.trimEnd()}`)
          }
        })
      }
    }

    walk(resolved)

    if (!results.length)
      return `未找到匹配 "${pattern}" 的内容（范围：${resolved}）`

    const capped = results.length >= limit ? `（已达上限 ${limit}，可能有更多）` : ''
    return `在 ${resolved} 搜索 "${pattern}"：${results.length} 条${capped}\n${'─'.repeat(40)}\n${results.join('\n')}`
  },
}

// ─── find_files ───────────────────────────────────────────────────────────────

const findFiles = {
  name: 'find_files',
  description: '递归查找匹配文件名或扩展名的文件（类 find），最多返回 200 个。',
  schema: {
    dir_path: { type: 'string', description: '搜索根目录绝对路径' },
    name_pattern: { type: 'string', description: '文件名关键词或扩展名（如 ".ts"）' },
    max_depth: { type: 'number', description: '最大深度（1-10，默认 6）', optional: true },
  },
  execute: async ({ dir_path, name_pattern, max_depth = 6 }) => {
    const resolved = path.resolve(dir_path)
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory())
      return `目录不存在：${resolved}`

    const depth = Math.min(Math.max(1, max_depth), 10)
    const MAX = 200
    const results = []
    const lower = name_pattern.toLowerCase()

    function walk(dir, cur) {
      if (cur > depth || results.length >= MAX) return
      let entries
      try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }

      for (const e of entries) {
        if (results.length >= MAX) break
        const full = path.join(dir, e.name)
        const rel = path.relative(resolved, full)
        const lname = e.name.toLowerCase()

        const match = lower.startsWith('.')
          ? lname.endsWith(lower)
          : lname.includes(lower)

        if (e.isFile() && match) {
          const size = fmtSize(fs.statSync(full).size)
          results.push(`📄  ${rel}  (${size})`)
        }
        if (e.isDirectory() && !IGNORED_DIRS.has(e.name) && !e.name.startsWith('.'))
          walk(full, cur + 1)
      }
    }

    walk(resolved, 1)

    if (!results.length)
      return `未找到匹配 "${name_pattern}" 的文件（范围：${resolved}，深度 ${depth}）`

    const capped = results.length >= MAX ? `（已达上限 ${MAX}）` : ''
    return `在 ${resolved} 查找 "${name_pattern}"：${results.length} 个${capped}\n${'─'.repeat(40)}\n${results.join('\n')}`
  },
}

// ─── export ───────────────────────────────────────────────────────────────────

module.exports = [readCodeFile, searchInFiles, findFiles]
