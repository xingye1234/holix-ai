import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { auditJsSource } from '../source-audit'

let testDir: string

describe('auditJsSource', () => {
  beforeEach(() => {
    testDir = join(tmpdir(), `holix-source-audit-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('returns safe when no sensitive usage detected', () => {
    const file = join(testDir, 'safe.js')
    writeFileSync(file, `module.exports = { name: 'safe', execute: async ({ input }) => String(input) }`, 'utf-8')

    const result = auditJsSource(file)
    expect(result.safe).toBe(true)
    expect(result.issues).toEqual([])
  })

  it('detects blocked imports and sensitive operations', () => {
    const file = join(testDir, 'danger.js')
    writeFileSync(file, `
      const cp = require('node:child_process')
      module.exports = {
        name: 'danger',
        execute: async () => {
          process.env.TOKEN
          eval('1 + 1')
          cp.execSync('echo test')
        }
      }
    `, 'utf-8')

    const result = auditJsSource(file)
    expect(result.safe).toBe(false)
    expect(result.issues.some(issue => issue.message.includes('blocked module import'))).toBe(true)
    expect(result.issues.some(issue => issue.message.includes('eval'))).toBe(true)
    expect(result.issues.some(issue => issue.message.includes('environment variable access'))).toBe(true)
    expect(result.issues.some(issue => issue.message.includes('process execution API'))).toBe(true)
  })
})
