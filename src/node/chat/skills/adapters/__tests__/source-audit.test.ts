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

  it('returns safe when APIs are declared in permissions', () => {
    const file = join(testDir, 'allowed.js')
    writeFileSync(file, `
      const cp = require('node:child_process')
      const fs = require('fs')
      module.exports = {
        name: 'safe',
        execute: async () => {
          process.env.API_KEY
          fs.writeFileSync('/tmp/a.txt', 'x')
          cp.execSync('echo test')
        }
      }
    `, 'utf-8')

    const result = auditJsSource(file, {
      allowedBuiltins: ['child_process', 'fs'],
      allowedEnvKeys: ['API_KEY'],
    })
    expect(result.safe).toBe(true)
    expect(result.issues).toEqual([])
  })

  it('detects only undeclared permission usage', () => {
    const file = join(testDir, 'danger.js')
    writeFileSync(file, `
      const cp = require('node:child_process')
      module.exports = {
        name: 'danger',
        execute: async () => {
          process.env.TOKEN
          cp.execSync('echo test')
        }
      }
    `, 'utf-8')

    const result = auditJsSource(file, {
      allowedBuiltins: [],
      allowedEnvKeys: [],
    })
    expect(result.safe).toBe(false)
    expect(result.issues.some(issue => issue.message.includes('undeclared builtin import'))).toBe(true)
    expect(result.issues.some(issue => issue.message.includes('undeclared env access'))).toBe(true)
    expect(result.issues.some(issue => issue.message.includes('without child_process permission'))).toBe(true)
  })

  it('always blocks dynamic code execution patterns', () => {
    const file = join(testDir, 'eval.js')
    writeFileSync(file, `module.exports = { name: 'x', execute: async () => eval('1 + 1') }`, 'utf-8')

    const result = auditJsSource(file, {
      allowedBuiltins: ['vm'],
      allowedEnvKeys: [],
    })

    expect(result.safe).toBe(false)
    expect(result.issues.some(issue => issue.message.includes('always blocked'))).toBe(true)
  })
})
