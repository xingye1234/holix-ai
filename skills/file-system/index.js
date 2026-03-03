'use strict'

/**
 * file-system — 内置文件系统工具集
 *
 * 工具列表：
 *   read_file          读取文件内容（超 256KB 截断）
 *   write_file         写入 / 追加文件
 *   list_directory     列举目录（非递归）
 *   file_exists        检查路径存在及类型
 *   get_directory_tree 递归目录树（限深度 / 每层上限）
 */

const fs = require('node:fs')
const path = require('node:path')

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

// ─── read_file ────────────────────────────────────────────────────────────────

const readFile = {
  name: 'read_file',
  description: '读取文件内容。超过 256KB 的文件会被截断并提示。',
  schema: {
    file_path: { type: 'string', description: '文件的绝对路径' },
    encoding: { type: 'string', description: '文件编码（默认 utf-8）', optional: true },
  },
  execute: async ({ file_path, encoding = 'utf-8' }) => {
    const resolved = path.resolve(file_path)

    if (!fs.existsSync(resolved))
      return `文件不存在：${resolved}`

    const stat = fs.statSync(resolved)
    if (!stat.isFile())
      return `路径不是文件：${resolved}（${stat.isDirectory() ? '目录' : '其他'}）`

    const MAX = 256 * 1024
    if (stat.size > MAX) {
      const fd = fs.openSync(resolved, 'r')
      const buf = Buffer.alloc(MAX)
      const read = fs.readSync(fd, buf, 0, MAX, 0)
      fs.closeSync(fd)
      return `[文件过大（${fmtSize(stat.size)}），仅显示前 256KB]\n\n${buf.slice(0, read).toString(encoding)}`
    }

    return fs.readFileSync(resolved, encoding)
  },
}

// ─── write_file ───────────────────────────────────────────────────────────────

const writeFile = {
  name: 'write_file',
  description: '写入文件（覆盖或追加）。父目录不存在时自动创建。',
  schema: {
    file_path: { type: 'string', description: '目标文件的绝对路径' },
    content: { type: 'string', description: '要写入的文本内容' },
    append: { type: 'boolean', description: '是否追加（默认 false = 覆盖）', optional: true },
  },
  execute: async ({ file_path, content, append = false }) => {
    const resolved = path.resolve(file_path)
    const dir = path.dirname(resolved)

    if (!fs.existsSync(dir))
      fs.mkdirSync(dir, { recursive: true })

    if (append) {
      fs.appendFileSync(resolved, content, 'utf-8')
      return `已追加到：${resolved}（${content.length} 字符）`
    }
    fs.writeFileSync(resolved, content, 'utf-8')
    return `已写入：${resolved}（${content.length} 字符）`
  },
}

// ─── list_directory ───────────────────────────────────────────────────────────

const listDirectory = {
  name: 'list_directory',
  description: '列举目录下的文件和子目录（不递归）。',
  schema: {
    dir_path: { type: 'string', description: '要列举的目录绝对路径' },
    show_hidden: { type: 'boolean', description: '是否显示隐藏文件（默认 false）', optional: true },
  },
  execute: async ({ dir_path, show_hidden = false }) => {
    const resolved = path.resolve(dir_path)

    if (!fs.existsSync(resolved)) return `目录不存在：${resolved}`
    if (!fs.statSync(resolved).isDirectory()) return `路径不是目录：${resolved}`

    const entries = fs.readdirSync(resolved, { withFileTypes: true })
    const filtered = show_hidden ? entries : entries.filter(e => !e.name.startsWith('.'))

    const dirs = filtered.filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))
    const files = filtered.filter(e => e.isFile()).sort((a, b) => a.name.localeCompare(b.name))

    const lines = [`目录：${resolved}`, `共 ${filtered.length} 个条目`, '']
    for (const d of dirs) lines.push(`📁  ${d.name}/`)
    for (const f of files) {
      const size = fmtSize(fs.statSync(path.join(resolved, f.name)).size)
      lines.push(`📄  ${f.name}  (${size})`)
    }
    return lines.join('\n')
  },
}

// ─── file_exists ──────────────────────────────────────────────────────────────

const fileExists = {
  name: 'file_exists',
  description: '检查文件或目录是否存在，返回类型和大小信息。',
  schema: {
    file_path: { type: 'string', description: '要检查的绝对路径' },
  },
  execute: async ({ file_path }) => {
    const resolved = path.resolve(file_path)
    if (!fs.existsSync(resolved)) return `不存在：${resolved}`

    const stat = fs.statSync(resolved)
    const type = stat.isDirectory() ? '目录' : stat.isFile() ? '文件' : stat.isSymbolicLink() ? '符号链接' : '其他'
    const size = stat.isFile() ? `，大小 ${fmtSize(stat.size)}` : ''
    return `存在（${type}${size}）：${resolved}`
  },
}

// ─── get_directory_tree ───────────────────────────────────────────────────────

const getDirectoryTree = {
  name: 'get_directory_tree',
  description: '递归输出目录结构树（默认 3 层深，每层最多 50 个条目）。',
  schema: {
    dir_path: { type: 'string', description: '根目录的绝对路径' },
    max_depth: { type: 'number', description: '最大递归深度（1-5，默认 3）', optional: true },
    show_hidden: { type: 'boolean', description: '是否包含隐藏条目（默认 false）', optional: true },
  },
  execute: async ({ dir_path, max_depth = 3, show_hidden = false }) => {
    const resolved = path.resolve(dir_path)
    if (!fs.existsSync(resolved)) return `目录不存在：${resolved}`
    if (!fs.statSync(resolved).isDirectory()) return `路径不是目录：${resolved}`

    const depth = Math.min(Math.max(1, max_depth), 5)
    const lines = [resolved]
    let total = 0
    const MAX_PER_DIR = 50

    function walk(dir, prefix, cur) {
      if (cur > depth) return
      let entries
      try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }

      const filtered = show_hidden ? entries : entries.filter(e => !e.name.startsWith('.'))
      const sorted = filtered.sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      const shown = sorted.slice(0, MAX_PER_DIR)
      const hidden = sorted.length - shown.length

      shown.forEach((e, idx) => {
        total++
        const last = idx === shown.length - 1 && hidden === 0
        const conn = last ? '└── ' : '├── '
        const next = prefix + (last ? '    ' : '│   ')
        if (e.isDirectory()) {
          lines.push(`${prefix}${conn}📁 ${e.name}/`)
          if (cur < depth) walk(path.join(dir, e.name), next, cur + 1)
        } else {
          lines.push(`${prefix}${conn}${e.name}`)
        }
      })
      if (hidden > 0) lines.push(`${prefix}└── ... （${hidden} 个条目已省略）`)
    }

    walk(resolved, '', 1)
    lines.push(`\n共 ${total} 个条目（深度 ${depth}）`)
    return lines.join('\n')
  },
}

// ─── export ───────────────────────────────────────────────────────────────────

module.exports = [readFile, writeFile, listDirectory, fileExists, getDirectoryTree]
