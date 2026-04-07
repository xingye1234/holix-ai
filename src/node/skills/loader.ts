/**
 * SkillLoader：扫描标准技能目录并解析可加载的 skill。
 *
 * 规范目录：
 * - metadata.json
 * - entry 指向的指令文件（通常为 SKILL.md）
 */

import type { LoadedSkill, StandardSkillMetadata } from './type'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, normalize } from 'node:path'
import { logger } from '../platform/logger'

function validateMetadata(raw: unknown, source: string): StandardSkillMetadata | null {
  if (!raw || typeof raw !== 'object') {
    logger.warn(`[skill-loader] Invalid metadata at ${source}: not an object`)
    return null
  }

  const obj = raw as Record<string, unknown>
  if (typeof obj.name !== 'string' || !obj.name.trim()) {
    logger.warn(`[skill-loader] Invalid metadata at ${source}: "name" is required`)
    return null
  }
  if (typeof obj.version !== 'string' || !obj.version.trim()) {
    logger.warn(`[skill-loader] Invalid metadata at ${source}: "version" is required`)
    return null
  }
  if (typeof obj.description !== 'string' || !obj.description.trim()) {
    logger.warn(`[skill-loader] Invalid metadata at ${source}: "description" is required`)
    return null
  }
  if (typeof obj.entry !== 'string' || !obj.entry.trim()) {
    logger.warn(`[skill-loader] Invalid metadata at ${source}: "entry" is required`)
    return null
  }

  return {
    name: obj.name.trim(),
    version: obj.version.trim(),
    description: obj.description.trim(),
    author: typeof obj.author === 'string' ? obj.author.trim() : undefined,
    tags: Array.isArray(obj.tags) ? obj.tags.filter((t): t is string => typeof t === 'string') : undefined,
    entry: obj.entry.trim(),
    allowedTools: Array.isArray(obj.allowedTools)
      ? obj.allowedTools.filter((tool): tool is string => typeof tool === 'string' && tool.trim().length > 0)
      : undefined,
    config: Array.isArray(obj.config) ? obj.config as StandardSkillMetadata['config'] : undefined,
  }
}

function isSafeRelativePath(pathLike: string): boolean {
  return pathLike.length > 0
    && !pathLike.startsWith('/')
    && !pathLike.includes('..')
}

function listFilesRecursively(dirPath: string, prefix: string): string[] {
  if (!existsSync(dirPath) || !statSync(dirPath).isDirectory())
    return []

  const result: string[] = []
  const stack: Array<{ abs: string, rel: string }> = [{ abs: dirPath, rel: prefix }]

  while (stack.length) {
    const current = stack.pop()!
    for (const entry of readdirSync(current.abs)) {
      const abs = join(current.abs, entry)
      const rel = `${current.rel}/${entry}`
      const stat = statSync(abs)
      if (stat.isDirectory()) {
        stack.push({ abs, rel })
      }
      else if (stat.isFile()) {
        result.push(rel)
      }
    }
  }

  result.sort()
  return result
}

function buildSkillPrompt(skillName: string, entryContent: string, skillDir: string) {
  const sections = [
    ...listFilesRecursively(join(skillDir, 'scripts'), 'scripts'),
    ...listFilesRecursively(join(skillDir, 'references'), 'references'),
    ...listFilesRecursively(join(skillDir, 'assets'), 'assets'),
    ...listFilesRecursively(join(skillDir, 'tests'), 'tests'),
  ]

  const wrapped = `<skill_content name="${skillName}">\n\n${entryContent.trim()}\n\n</skill_content>`

  if (!sections.length) {
    return wrapped
  }

  return `${wrapped}\n\n<skill_resources>\n${sections.map(file => `- ${file}`).join('\n')}\n</skill_resources>`
}

function loadSkillFromDir(skillDir: string): LoadedSkill | null {
  const metadataPath = join(skillDir, 'metadata.json')

  if (!existsSync(metadataPath)) {
    logger.debug(`[skill-loader] Skip legacy skill directory without metadata.json: ${skillDir}`)
    return null
  }

  try {
    const raw = JSON.parse(readFileSync(metadataPath, 'utf-8'))
    const metadata = validateMetadata(raw, metadataPath)
    if (!metadata) {
      return null
    }

    if (!isSafeRelativePath(metadata.entry)) {
      logger.warn(`[skill-loader] Invalid metadata.entry for ${metadata.name}: ${metadata.entry}`)
      return null
    }

    const entryPath = normalize(join(skillDir, metadata.entry))
    if (!existsSync(entryPath) || !statSync(entryPath).isFile()) {
      logger.warn(`[skill-loader] Skill entry not found for ${metadata.name}: ${entryPath}`)
      return null
    }

    logger.info(`[skill-loader] Loaded skill: ${metadata.name}`)

    return {
      name: metadata.name,
      version: metadata.version,
      description: metadata.description,
      prompt: buildSkillPrompt(metadata.name, readFileSync(entryPath, 'utf-8'), skillDir),
      dir: skillDir,
      allowedTools: metadata.allowedTools ?? [],
      config: metadata.config ?? [],
    }
  }
  catch (err) {
    logger.error(`[skill-loader] Failed to parse metadata at ${metadataPath}:`, err)
    return null
  }
}

export function scanSkillsDir(skillsDir: string): LoadedSkill[] {
  if (!existsSync(skillsDir)) {
    logger.debug(`[skill-loader] Skills directory does not exist: ${skillsDir}`)
    return []
  }

  const skills: LoadedSkill[] = []
  const nameSet = new Set<string>()
  let entries: string[]

  try {
    entries = readdirSync(skillsDir)
  }
  catch (err) {
    logger.error(`[skill-loader] Cannot read skills directory ${skillsDir}:`, err)
    return []
  }

  for (const entry of entries) {
    const fullPath = join(skillsDir, entry)

    try {
      const stat = statSync(fullPath)
      if (!stat.isDirectory()) {
        continue
      }

      const skill = loadSkillFromDir(fullPath)
      if (!skill) {
        continue
      }

      if (nameSet.has(skill.name)) {
        logger.warn(`[skill-loader] Duplicate skill name "${skill.name}", skipping entry "${entry}"`)
        continue
      }

      nameSet.add(skill.name)
      skills.push(skill)
    }
    catch (err) {
      logger.error(`[skill-loader] Error processing entry "${entry}":`, err)
    }
  }

  logger.info(`[skill-loader] Scanned "${skillsDir}": found ${skills.length} skill(s)`)
  return skills
}

export function getSkillsDir(userDataDir: string): string {
  return join(userDataDir, 'skills')
}
