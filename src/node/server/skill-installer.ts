import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
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
  const skillJson = join(targetDir, 'skill.json')
  if (existsSync(skillJson)) {
    return [targetDir]
  }

  return readdirSync(targetDir)
    .map(name => join(targetDir, name))
    .filter((dir) => {
      if (!statSync(dir).isDirectory())
        return false

      return existsSync(join(dir, 'skill.json'))
    })
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
      throw new Error(`在 ${relativePath} 下未找到包含 skill.json 的技能目录`)
    }

    const installed: string[] = []

    for (const dir of skillDirs) {
      const manifestPath = join(dir, 'skill.json')
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as { name?: string }
      const skillName = manifest.name?.trim() || basename(dir)
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
