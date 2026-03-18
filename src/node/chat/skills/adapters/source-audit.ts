import type { SandboxPermissions } from '../sandbox/types'
import { readFileSync } from 'node:fs'
import { normalizeSandboxPermissions } from '../sandbox/types'

export interface SourceAuditIssue {
  line: number
  message: string
  snippet: string
}

export interface SourceAuditResult {
  safe: boolean
  issues: SourceAuditIssue[]
}

const ALWAYS_BLOCKED_MODULES = new Set([
  'electron',
  'electron/main',
  'electron/renderer',
  'electron/common',
  'better-sqlite3',
  '@libsql/client',
])

const CHILD_PROCESS_BUILTINS = new Set(['child_process', 'node:child_process'])
const FS_BUILTINS = new Set(['fs', 'node:fs', 'fs/promises', 'node:fs/promises'])

const DYNAMIC_CODE_PATTERNS: Array<{ regex: RegExp, message: string }> = [
  { regex: /\b(eval\s*\()/, message: 'Detected eval() usage (always blocked)' },
  { regex: /\bnew\s+Function\s*\(/, message: 'Detected Function constructor usage (always blocked)' },
]

function toCanonicalBuiltin(moduleName: string): string {
  return moduleName.startsWith('node:') ? moduleName : `node:${moduleName}`
}

function getLineNumber(source: string, index: number): number {
  return source.slice(0, index).split('\n').length
}

function extractSnippet(source: string, index: number): string {
  const line = source.split('\n')[getLineNumber(source, index) - 1] ?? ''
  return line.trim().slice(0, 180)
}

function collectImports(source: string): Array<{ index: number, moduleName: string }> {
  const matches: Array<{ index: number, moduleName: string }> = []
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  const importFromRegex = /from\s*['"]([^'"]+)['"]/g
  const importOnlyRegex = /import\s*['"]([^'"]+)['"]/g

  for (const regex of [requireRegex, importFromRegex, importOnlyRegex]) {
    for (const match of source.matchAll(regex)) {
      matches.push({
        index: match.index ?? 0,
        moduleName: match[1],
      })
    }
  }

  return matches
}

function hasAllowedBuiltin(allowedBuiltins: Set<string>, modules: Set<string>): boolean {
  for (const mod of modules) {
    if (allowedBuiltins.has(mod))
      return true
  }
  return false
}

export function auditJsSource(filePath: string, permissions?: SandboxPermissions): SourceAuditResult {
  const source = readFileSync(filePath, 'utf-8')
  const issues: SourceAuditIssue[] = []
  const normalized = normalizeSandboxPermissions(permissions)
  const allowedBuiltins = new Set<string>()

  for (const builtin of normalized.allowedBuiltins) {
    allowedBuiltins.add(builtin)
    allowedBuiltins.add(toCanonicalBuiltin(builtin))
  }

  for (const { index, moduleName } of collectImports(source)) {
    const canonical = toCanonicalBuiltin(moduleName)
    const isBuiltin = moduleName.startsWith('node:') || !moduleName.includes('/') || moduleName.startsWith('@')

    if (!isBuiltin)
      continue

    if (ALWAYS_BLOCKED_MODULES.has(moduleName) || ALWAYS_BLOCKED_MODULES.has(canonical)) {
      issues.push({
        line: getLineNumber(source, index),
        message: `Detected hard-blocked module import: ${moduleName}`,
        snippet: extractSnippet(source, index),
      })
      continue
    }

    if (!allowedBuiltins.has(moduleName) && !allowedBuiltins.has(canonical)) {
      issues.push({
        line: getLineNumber(source, index),
        message: `Detected undeclared builtin import: ${moduleName}`,
        snippet: extractSnippet(source, index),
      })
    }
  }

  for (const pattern of DYNAMIC_CODE_PATTERNS) {
    for (const match of source.matchAll(new RegExp(pattern.regex.source, 'g'))) {
      const index = match.index ?? 0
      issues.push({
        line: getLineNumber(source, index),
        message: pattern.message,
        snippet: extractSnippet(source, index),
      })
    }
  }

  for (const match of source.matchAll(/\bprocess\.env(?:\.([A-Z0-9_]+)|\[['"]([^'"]+)['"]\])/g)) {
    const index = match.index ?? 0
    const key = match[1] || match[2]

    if (!key) {
      issues.push({
        line: getLineNumber(source, index),
        message: 'Detected dynamic process.env access, declare explicit allowedEnvKeys',
        snippet: extractSnippet(source, index),
      })
      continue
    }

    if (!normalized.allowedEnvKeys.includes(key)) {
      issues.push({
        line: getLineNumber(source, index),
        message: `Detected undeclared env access: ${key}`,
        snippet: extractSnippet(source, index),
      })
    }
  }

  for (const match of source.matchAll(/\b(exec|execSync|spawn|spawnSync|fork)\s*\(/g)) {
    const index = match.index ?? 0
    if (!hasAllowedBuiltin(allowedBuiltins, CHILD_PROCESS_BUILTINS)) {
      issues.push({
        line: getLineNumber(source, index),
        message: 'Detected process execution API without child_process permission',
        snippet: extractSnippet(source, index),
      })
    }
  }

  for (const match of source.matchAll(/\b(fs\.)?(writeFileSync|writeFile|appendFileSync|appendFile|rmSync|rm|unlinkSync|unlink|chmodSync|chmod|chownSync|chown)\s*\(/g)) {
    const index = match.index ?? 0
    if (!hasAllowedBuiltin(allowedBuiltins, FS_BUILTINS)) {
      issues.push({
        line: getLineNumber(source, index),
        message: 'Detected filesystem mutation API without fs permission',
        snippet: extractSnippet(source, index),
      })
    }
  }

  return {
    safe: issues.length === 0,
    issues,
  }
}
