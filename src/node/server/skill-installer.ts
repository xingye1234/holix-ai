import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

interface InstallOptions {
  source: string
  path?: string
  ref?: string
  destinationDir: string
}

interface InstallResult {
  installed: string[]
}

interface ParsedSource {
  repo: string
  ref?: string
  path?: string
}

export function parseGitHubSource(source: string): ParsedSource {
  const input = source.trim()

  if (input.startsWith('https://github.com/') || input.startsWith('http://github.com/')) {
    const url = new URL(input)
    const segments = url.pathname.split('/').filter(Boolean)
    if (segments.length >= 2) {
      const owner = segments[0]
      const repo = segments[1].replace(/\.git$/, '')

      if (segments[2] === 'tree' && segments[3]) {
        return {
          repo: `${owner}/${repo}`,
          ref: segments[3],
          path: segments.slice(4).join('/'),
        }
      }

      return { repo: `${owner}/${repo}` }
    }
  }

  const shortMatch = input.match(/^([\w.-]+)\/([\w.-]+)$/)
  if (shortMatch) {
    const [, owner, repo] = shortMatch
    return { repo: `${owner}/${repo.replace(/\.git$/, '')}` }
  }

  throw new Error('仅支持 GitHub 仓库地址，例如 https://github.com/antfu/skills 或 antfu/skills')
}

export function collectSkillDirs(targetDir: string): string[] {
  const hasSupportedSkillFile = (dir: string) => {
    return [
      'skill.json',
      'SKILL.md',
      'AGENTS.md',
      'CLAUDE.md',
      'GEMINI.md',
      'GROK.md',
      'QWEN.md',
      'copilot-instructions.md',
    ].some(file => existsSync(join(dir, file)))
  }

  if (hasSupportedSkillFile(targetDir)) {
    return [targetDir]
  }

  return readdirSync(targetDir)
    .map(name => join(targetDir, name))
    .filter((dir) => {
      if (!statSync(dir).isDirectory())
        return false

      return hasSupportedSkillFile(dir)
    })
}

function toSkillName(dir: string): string {
  return basename(dir)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
}

function pickPromptSourceFile(skillDir: string): string | null {
  const candidates = [
    'SKILL.md',
    'AGENTS.md',
    'CLAUDE.md',
    'GEMINI.md',
    'GROK.md',
    'QWEN.md',
    'copilot-instructions.md',
  ]

  for (const file of candidates) {
    const full = join(skillDir, file)
    if (existsSync(full)) {
      return full
    }
  }

  return null
}

function toDescription(prompt: string, fallback: string): string {
  const firstMeaningfulLine = prompt
    .split('\n')
    .map(line => line.trim())
    .find(line => line.length > 0 && line !== '---' && !line.endsWith(':'))

  if (!firstMeaningfulLine) {
    return fallback
  }

  return firstMeaningfulLine.replace(/^#+\s*/, '').slice(0, 120) || fallback
}

function ensureSkillManifest(skillDir: string): { name: string } {
  const manifestPath = join(skillDir, 'skill.json')
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as { name?: string }
    return { name: manifest.name?.trim() || basename(skillDir) }
  }

  const promptSource = pickPromptSourceFile(skillDir)
  if (!promptSource) {
    throw new Error(`未找到可识别的技能文件: ${skillDir}`)
  }

  const skillName = toSkillName(skillDir)
  const prompt = readFileSync(promptSource, 'utf-8').trim()
  const generated = {
    name: skillName,
    version: '1.0.0',
    description: toDescription(prompt, `Imported from ${basename(promptSource)}`),
    prompt,
  }

  writeFileSync(manifestPath, JSON.stringify(generated, null, 2))
  return { name: skillName }
}

export function installSkillsFromGitHub(options: InstallOptions): InstallResult {
  const parsed = parseGitHubSource(options.source)
  const ref = options.ref?.trim() || parsed.ref || 'main'
  const relativePath = options.path?.trim() || parsed.path || 'skills'

  const tempDir = mkdtempSync(join(tmpdir(), 'holixai-skill-'))

  try {
    execFileSync('git', ['clone', '--depth', '1', '--branch', ref, `https://github.com/${parsed.repo}.git`, tempDir], {
      stdio: 'pipe',
    })

    const sourceRoot = join(tempDir, relativePath)
    if (!existsSync(sourceRoot) || !statSync(sourceRoot).isDirectory()) {
      throw new Error(`路径不存在: ${relativePath}`)
    }

    const skillDirs = collectSkillDirs(sourceRoot)
    if (skillDirs.length === 0) {
      throw new Error(`在 ${relativePath} 下未找到可识别的技能目录（skill.json/SKILL.md/AGENTS.md/CLAUDE.md 等）`)
    }

    const installed: string[] = []

    for (const dir of skillDirs) {
      const { name: skillName } = ensureSkillManifest(dir)
      const dest = join(options.destinationDir, skillName)

      if (existsSync(dest)) {
        throw new Error(`Skill 已存在: ${skillName}`)
      }

      cpSync(dir, dest, { recursive: true })
      installed.push(skillName)
    }

    return { installed }
  }
  finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}
