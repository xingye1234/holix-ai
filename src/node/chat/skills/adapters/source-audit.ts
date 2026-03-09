import { readFileSync } from 'node:fs'

export interface SourceAuditIssue {
  line: number
  message: string
  snippet: string
}

export interface SourceAuditResult {
  safe: boolean
  issues: SourceAuditIssue[]
}

const BLOCKED_IMPORT_MODULES = [
  'child_process',
  'node:child_process',
  'vm',
  'node:vm',
  'worker_threads',
  'node:worker_threads',
]

const SENSITIVE_PATTERNS: Array<{ regex: RegExp, message: string }> = [
  { regex: /\b(eval\s*\()/, message: 'Detected eval() usage' },
  { regex: /\bnew\s+Function\s*\(/, message: 'Detected Function constructor usage' },
  { regex: /\b(exec|execSync|spawn|spawnSync|fork)\s*\(/, message: 'Detected process execution API usage' },
  { regex: /\b(process\.env\b|process\s*\[\s*["']env["']\s*\])/, message: 'Detected environment variable access' },
  { regex: /\b(fs\.)?(writeFileSync|writeFile|appendFileSync|appendFile|rmSync|rm|unlinkSync|unlink|chmodSync|chmod|chownSync|chown)\s*\(/, message: 'Detected filesystem mutation API usage' },
]

function getLineNumber(source: string, index: number): number {
  return source.slice(0, index).split('\n').length
}

function extractSnippet(source: string, index: number): string {
  const line = source.split('\n')[getLineNumber(source, index) - 1] ?? ''
  return line.trim().slice(0, 180)
}

export function auditJsSource(filePath: string): SourceAuditResult {
  const source = readFileSync(filePath, 'utf-8')
  const issues: SourceAuditIssue[] = []

  for (const mod of BLOCKED_IMPORT_MODULES) {
    const importRegex = new RegExp(`(?:require\\s*\\(\\s*['\"]${mod}['\"]\\s*\\)|from\\s*['\"]${mod}['\"])`, 'g')
    for (const match of source.matchAll(importRegex)) {
      const index = match.index ?? 0
      issues.push({
        line: getLineNumber(source, index),
        message: `Detected blocked module import: ${mod}`,
        snippet: extractSnippet(source, index),
      })
    }
  }

  for (const pattern of SENSITIVE_PATTERNS) {
    for (const match of source.matchAll(new RegExp(pattern.regex.source, 'g'))) {
      const index = match.index ?? 0
      issues.push({
        line: getLineNumber(source, index),
        message: pattern.message,
        snippet: extractSnippet(source, index),
      })
    }
  }

  return {
    safe: issues.length === 0,
    issues,
  }
}
