/**
 * file-system skill — 内置文件系统工具集
 *
 * 工具列表：
 *   read_file         读取文件内容
 *   write_file        写入/创建文件
 *   list_directory    列举目录内容
 *   file_exists       检查路径是否存在
 *   get_directory_tree  递归目录树（带深度限制）
 *
 * 编译方式：tsdown --config tsdown.skills.config.ts
 * 运行环境：worker_threads + vm 沙箱（allowedBuiltins: fs, path, os）
 */

// ─── 类型声明 ──────────────────────────────────────────────────────────────────
// 在 execute 函数内部使用 require，避免顶层 require 影响元数据解析阶段

type FS = typeof import('node:fs')
type PATH = typeof import('node:path')
type OS = typeof import('node:os')

// ─── 工具：读取文件内容 ────────────────────────────────────────────────────────

const readFile = {
  name: 'read_file',
  description: '读取文件内容。支持文本文件，超过 256KB 的文件会被截断。',
  schema: {
    file_path: { type: 'string', description: '文件的绝对路径' },
    encoding: { type: 'string', description: '文件编码（默认 utf-8，可选 ascii/base64 等）', optional: true },
  },
  execute: async ({ file_path, encoding = 'utf-8' }: { file_path: string, encoding?: string }) => {
    const fs = require('node:fs') as FS
    const path = require('node:path') as PATH

    const resolved = path.resolve(file_path)

    if (!fs.existsSync(resolved))
      return `文件不存在：${resolved}`

    const stats = fs.statSync(resolved)

    if (!stats.isFile())
      return `路径不是文件：${resolved}（类型：${stats.isDirectory() ? '目录' : '其他'}）`

    const MAX_BYTES = 256 * 1024 // 256 KB
    if (stats.size > MAX_BYTES) {
      // 超大文件仅读取前 256KB
      const fd = fs.openSync(resolved, 'r')
      const buf = Buffer.alloc(MAX_BYTES)
      const read = fs.readSync(fd, buf, 0, MAX_BYTES, 0)
      fs.closeSync(fd)
      const content = buf.slice(0, read).toString(encoding as BufferEncoding)
      return `[文件过大（${Math.round(stats.size / 1024)}KB），仅显示前 256KB]\n\n${content}`
    }

    return fs.readFileSync(resolved, encoding as BufferEncoding)
  },
}

// ─── 工具：写入文件 ────────────────────────────────────────────────────────────

const writeFile = {
  name: 'write_file',
  description: '将内容写入文件（不存在则创建，若父目录不存在会自动创建）。',
  schema: {
    file_path: { type: 'string', description: '目标文件的绝对路径' },
    content: { type: 'string', description: '要写入的文本内容' },
    append: { type: 'boolean', description: '是否追加到文件末尾（默认 false = 覆盖）', optional: true },
  },
  execute: async ({
    file_path,
    content,
    append = false,
  }: {
    file_path: string
    content: string
    append?: boolean
  }) => {
    const fs = require('node:fs') as FS
    const path = require('node:path') as PATH

    const resolved = path.resolve(file_path)
    const dir = path.dirname(resolved)

    if (!fs.existsSync(dir))
      fs.mkdirSync(dir, { recursive: true })

    if (append) {
      fs.appendFileSync(resolved, content, 'utf-8')
      return `已追加内容到：${resolved}（追加 ${content.length} 字符）`
    }
    else {
      fs.writeFileSync(resolved, content, 'utf-8')
      return `已写入：${resolved}（${content.length} 字符）`
    }
  },
}

// ─── 工具：列举目录 ────────────────────────────────────────────────────────────

const listDirectory = {
  name: 'list_directory',
  description: '列举目录下的文件和子目录（不递归）。',
  schema: {
    dir_path: { type: 'string', description: '要列举的目录绝对路径' },
    show_hidden: { type: 'boolean', description: '是否显示以 . 开头的隐藏文件（默认 false）', optional: true },
  },
  execute: async ({ dir_path, show_hidden = false }: { dir_path: string, show_hidden?: boolean }) => {
    const fs = require('node:fs') as FS
    const path = require('node:path') as PATH

    const resolved = path.resolve(dir_path)

    if (!fs.existsSync(resolved))
      return `目录不存在：${resolved}`

    const stats = fs.statSync(resolved)
    if (!stats.isDirectory())
      return `路径不是目录：${resolved}`

    const entries = fs.readdirSync(resolved, { withFileTypes: true })
    const filtered = show_hidden ? entries : entries.filter(e => !e.name.startsWith('.'))

    const lines: string[] = [`目录：${resolved}`, `共 ${filtered.length} 个条目`, '']

    const dirs = filtered.filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))
    const files = filtered.filter(e => e.isFile()).sort((a, b) => a.name.localeCompare(b.name))

    for (const d of dirs)
      lines.push(`📁  ${d.name}/`)

    for (const f of files) {
      const fStats = fs.statSync(path.join(resolved, f.name))
      const size = fStats.size < 1024
        ? `${fStats.size}B`
        : fStats.size < 1024 * 1024
          ? `${Math.round(fStats.size / 1024)}KB`
          : `${(fStats.size / 1024 / 1024).toFixed(1)}MB`
      lines.push(`📄  ${f.name}  (${size})`)
    }

    return lines.join('\n')
  },
}

// ─── 工具：检查路径存在 ────────────────────────────────────────────────────────

const fileExists = {
  name: 'file_exists',
  description: '检查文件或目录是否存在，并返回类型信息。',
  schema: {
    file_path: { type: 'string', description: '要检查的绝对路径' },
  },
  execute: async ({ file_path }: { file_path: string }) => {
    const fs = require('node:fs') as FS
    const path = require('node:path') as PATH

    const resolved = path.resolve(file_path)

    if (!fs.existsSync(resolved))
      return `不存在：${resolved}`

    const stats = fs.statSync(resolved)
    const type = stats.isDirectory()
      ? '目录'
      : stats.isFile()
        ? '文件'
        : stats.isSymbolicLink()
          ? '符号链接'
          : '其他'

    const size = stats.isFile()
      ? `，大小 ${stats.size < 1024 ? `${stats.size}B` : `${Math.round(stats.size / 1024)}KB`}`
      : ''

    return `存在（${type}${size}）：${resolved}`
  },
}

// ─── 工具：目录树 ──────────────────────────────────────────────────────────────

const getDirectoryTree = {
  name: 'get_directory_tree',
  description: '递归输出目录结构树（最多 3 层深，每层最多 50 个条目）。适合了解项目结构。',
  schema: {
    dir_path: { type: 'string', description: '根目录的绝对路径' },
    max_depth: { type: 'number', description: '最大递归深度（1-5，默认 3）', optional: true },
    show_hidden: { type: 'boolean', description: '是否包含隐藏文件/目录（默认 false）', optional: true },
  },
  execute: async ({
    dir_path,
    max_depth = 3,
    show_hidden = false,
  }: {
    dir_path: string
    max_depth?: number
    show_hidden?: boolean
  }) => {
    const fs = require('node:fs') as FS
    const path = require('node:path') as PATH

    const resolved = path.resolve(dir_path)
    const depth = Math.min(Math.max(1, max_depth), 5)

    if (!fs.existsSync(resolved))
      return `目录不存在：${resolved}`

    if (!fs.statSync(resolved).isDirectory())
      return `路径不是目录：${resolved}`

    const lines: string[] = [resolved]
    let totalCount = 0
    const MAX_ENTRIES_PER_DIR = 50

    function walk(dirPath: string, prefix: string, currentDepth: number): void {
      if (currentDepth > depth)
        return

      let entries: import('node:fs').Dirent[]
      try {
        entries = fs.readdirSync(dirPath, { withFileTypes: true })
      }
      catch {
        return
      }

      const filtered = show_hidden ? entries : entries.filter(e => !e.name.startsWith('.'))
      const sorted = filtered.sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory())
          return a.isDirectory() ? -1 : 1
        return a.name.localeCompare(b.name)
      })

      const truncated = sorted.slice(0, MAX_ENTRIES_PER_DIR)
      const hiddenCount = sorted.length - truncated.length

      truncated.forEach((entry, idx) => {
        totalCount++
        const isLast = idx === truncated.length - 1 && hiddenCount === 0
        const connector = isLast ? '└── ' : '├── '
        const childPrefix = prefix + (isLast ? '    ' : '│   ')

        if (entry.isDirectory()) {
          lines.push(`${prefix}${connector}📁 ${entry.name}/`)
          if (currentDepth < depth)
            walk(path.join(dirPath, entry.name), childPrefix, currentDepth + 1)
        }
        else {
          lines.push(`${prefix}${connector}${entry.name}`)
        }
      })

      if (hiddenCount > 0)
        lines.push(`${prefix}└── ... （${hiddenCount} 个条目已省略）`)
    }

    walk(resolved, '', 1)
    lines.push(`\n共 ${totalCount} 个条目（深度 ${depth}）`)

    return lines.join('\n')
  },
}

// ─── 导出 ──────────────────────────────────────────────────────────────────────

export default [
  readFile,
  writeFile,
  listDirectory,
  fileExists,
  getDirectoryTree,
]
