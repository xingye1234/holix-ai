import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('built-in skills standard format', () => {
  const rootSkillsDir = path.resolve('skills')

  it.each([
    ['shell', ['execute']],
    ['file-system', ['ls', 'glob', 'grep', 'read_file', 'write_file', 'edit_file']],
    ['code-reader', ['glob', 'grep', 'read_file']],
    ['web-search', []],
  ])('keeps %s in metadata.json + SKILL.md format', (dirName, expectedAllowedTools) => {
    const skillDir = path.join(rootSkillsDir, dirName)
    const metadataPath = path.join(skillDir, 'metadata.json')
    const skillPath = path.join(skillDir, 'SKILL.md')

    expect(existsSync(metadataPath)).toBe(true)
    expect(existsSync(skillPath)).toBe(true)

    const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8')) as {
      name: string
      entry: string
      allowedTools?: string[]
    }

    expect(metadata.name.length).toBeGreaterThan(0)
    expect(metadata.entry).toBe('SKILL.md')
    expect(metadata.allowedTools ?? []).toEqual(expectedAllowedTools)
    expect(readFileSync(skillPath, 'utf-8').trim().length).toBeGreaterThan(0)
  })
})
