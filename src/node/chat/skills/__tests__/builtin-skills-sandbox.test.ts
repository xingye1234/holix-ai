import type { JsToolDeclaration, SkillManifest } from '../type'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { loadJsTools } from '../adapters/js'

vi.mock('../../../platform/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('../../../database/skill-config', () => ({
  getSkillConfig: () => ({}),
  setSkillConfigField: vi.fn(),
  getSkillConfigField: vi.fn(),
  deleteSkillConfig: vi.fn(),
}))

function readManifest(skillDir: string): SkillManifest {
  return JSON.parse(readFileSync(path.join(skillDir, 'skill.json'), 'utf-8')) as SkillManifest
}

describe('built-in skills sandbox execution (production loader path)', () => {
  const rootSkillsDir = path.resolve('skills')
  let sandboxRoot = ''
  let sandboxDir = ''
  // eslint-disable-next-line prefer-const
  let tools: Record<string, ReturnType<typeof loadJsTools>[number]> = {}

  beforeAll(() => {
    sandboxRoot = mkdtempSync(path.join(os.tmpdir(), 'holix-skills-vitest-'))
    sandboxDir = path.join(sandboxRoot, 'workspace')
    mkdirSync(sandboxDir, { recursive: true })

    for (const dirName of ['shell', 'file-system', 'code-reader', 'web-search']) {
      const skillDir = path.join(rootSkillsDir, dirName)
      const manifest = readManifest(skillDir)
      const declarations = (manifest.tools ?? []).filter((tool): tool is JsToolDeclaration => tool.type === 'js')

      for (const decl of declarations) {
        const loaded = loadJsTools(decl, skillDir, manifest.name, [])
        expect(loaded.length).toBeGreaterThan(0)
        for (const tool of loaded)
          tools[tool.name] = tool
      }
    }
  })

  afterAll(() => {
    if (sandboxRoot)
      rmSync(sandboxRoot, { recursive: true, force: true })
  })

  it('runs file-system tools via src/node/chat sandbox adapter', async () => {
    const sampleFile = path.join(sandboxDir, 'demo.txt')

    await expect(tools.write_file.invoke({ file_path: sampleFile, content: 'line-1\nline-2' })).resolves.toMatch(/已写入：/)
    await expect(tools.write_file.invoke({ file_path: sampleFile, content: '\nline-3', append: true })).resolves.toMatch(/已追加到：/)
    await expect(tools.read_file.invoke({ file_path: sampleFile })).resolves.toBe('line-1\nline-2\nline-3')
    await expect(tools.list_directory.invoke({ dir_path: sandboxDir })).resolves.toMatch(/demo\.txt/)
    await expect(tools.file_exists.invoke({ file_path: sampleFile })).resolves.toMatch(/存在（文件/)
    await expect(tools.get_directory_tree.invoke({ dir_path: sandboxRoot, max_depth: 2 })).resolves.toMatch(/workspace\//)
  })

  it('runs code-reader tools via src/node/chat sandbox adapter', async () => {
    const codeFile = path.join(sandboxDir, 'sample.ts')
    writeFileSync(codeFile, 'const value = 42\nconsole.log(value)\n', 'utf-8')

    await expect(tools.read_code_file.invoke({ file_path: codeFile, start_line: 1, end_line: 2 })).resolves.toMatch(/1 │ const value = 42/)
    await expect(tools.search_in_files.invoke({ dir_path: sandboxDir, pattern: 'console.log', file_ext: '.ts' })).resolves.toMatch(/sample\.ts/)
    await expect(tools.find_files.invoke({ dir_path: sandboxDir, name_pattern: '.ts' })).resolves.toMatch(/sample\.ts/)
  })


  it('runs web-search tool validation path without token', async () => {
    await expect(tools.web_search.invoke({ search_query: 'holix ai' })).resolves.toMatch(/未配置 apiToken/)
  })

  it('runs web-browser tool validation path without token', async () => {
    await expect(tools.web_browser.invoke({ url: 'https://example.com' })).resolves.toMatch(/未配置 apiToken/)
  })

  it('runs shell tools via src/node/chat sandbox adapter', async () => {
    await expect(tools.run_shell_command.invoke({ command: 'pwd && echo sandbox-ok', cwd: sandboxDir })).resolves.toMatch(/退出码：0/)
    await expect(tools.run_shell_command.invoke({ command: 'pwd && echo sandbox-ok', cwd: sandboxDir })).resolves.toMatch(/sandbox-ok/)
    await expect(tools.get_environment_info.invoke({})).resolves.toMatch(/Node 版本：/)
  })
})
