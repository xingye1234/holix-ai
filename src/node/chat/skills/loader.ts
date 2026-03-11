/**
 * SkillLoader：扫描 skills 目录并解析可加载的 skill。
 *
 * 当前优先支持规范目录：
 * - metadata.json（必需）
 * - entry 指向的指令文件（通常为 SKILL.md）
 *
 * 兼容保留：
 * - 目录中的 skill.json（历史格式，含 tools）
 * - 独立 .json/.md 文件（历史格式）
 */

import type { DynamicStructuredTool } from '@langchain/core/tools'
import type { LoadedSkill, SkillManifest, SkillMdFrontmatter, ToolDeclaration } from './type'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, extname, join, normalize } from 'node:path'
import matter from 'gray-matter'
import { logger } from '../../platform/logger'
import { wrapWithApproval } from '../tools/approval'
import { wrapWithSkillInvocationLog } from '../tools/skill-invocation'
import { commandToTool, scriptToTool } from './adapters/command'
import { loadJsTools } from './adapters/js'
import { requiresApprovalForPermissions } from './sandbox/types'

interface StandardSkillMetadata {
  name: string
  version: string
  description: string
  author?: string
  tags?: string[]
  entry: string
}

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
  }
}

function validateManifest(raw: unknown, source: string): SkillManifest | null {
  if (!raw || typeof raw !== 'object') {
    logger.warn(`[skill-loader] Invalid manifest at ${source}: not an object`)
    return null
  }

  const obj = raw as Record<string, unknown>

  if (typeof obj.name !== 'string' || !obj.name.trim()) {
    logger.warn(`[skill-loader] Invalid manifest at ${source}: "name" is required`)
    return null
  }

  if (typeof obj.description !== 'string' || !obj.description.trim()) {
    logger.warn(`[skill-loader] Invalid manifest at ${source}: "description" is required`)
    return null
  }

  return {
    name: obj.name.trim(),
    version: typeof obj.version === 'string' ? obj.version : '1.0.0',
    description: obj.description.trim(),
    prompt: typeof obj.prompt === 'string' ? obj.prompt : undefined,
    disabled: obj.disabled === true,
    tools: Array.isArray(obj.tools) ? (obj.tools as ToolDeclaration[]) : [],
    config: Array.isArray(obj.config) ? obj.config as SkillManifest['config'] : undefined,
  }
}

function buildTools(
  declarations: ToolDeclaration[],
  skillDir: string,
  skillName: string,
  configFieldKeys: string[] = [],
): DynamicStructuredTool[] {
  const tools: DynamicStructuredTool[] = []

  for (const decl of declarations) {
    try {
      switch (decl.type) {
        case 'js': {
          const jsTools = loadJsTools(decl, skillDir, skillName, configFieldKeys)
          const needsApproval = decl.dangerous === true || requiresApprovalForPermissions(decl.permissions)
          if (needsApproval) {
            logger.info(`[skill-loader] js tool "${decl.name}" requires approval`)
            tools.push(...jsTools.map(t => wrapWithSkillInvocationLog(wrapWithApproval(t, skillName), skillName)))
          }
          else {
            tools.push(...jsTools.map(t => wrapWithSkillInvocationLog(t, skillName)))
          }
          break
        }
        case 'command': {
          const commandTool = wrapWithApproval(commandToTool(decl, skillDir, skillName, configFieldKeys), skillName)
          tools.push(wrapWithSkillInvocationLog(commandTool, skillName))
          break
        }
        case 'script': {
          const scriptTool = wrapWithApproval(scriptToTool(decl, skillDir, skillName, configFieldKeys), skillName)
          tools.push(wrapWithSkillInvocationLog(scriptTool, skillName))
          break
        }
        default:
          logger.warn(`[skill-loader] Unknown tool type: ${(decl as any).type}`)
      }
    }
    catch (err) {
      logger.error('[skill-loader] Failed to build tool from declaration:', decl, err)
    }
  }

  return tools
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

function buildStandardPrompt(skillName: string, entryContent: string, skillDir: string): string {
  const sections = [
    ...listFilesRecursively(join(skillDir, 'scripts'), 'scripts'),
    ...listFilesRecursively(join(skillDir, 'references'), 'references'),
    ...listFilesRecursively(join(skillDir, 'assets'), 'assets'),
    ...listFilesRecursively(join(skillDir, 'tests'), 'tests'),
  ]

  const content = entryContent.trim()
  const wrapped = `<skill_content name="${skillName}">\n\n${content}\n\n</skill_content>`

  if (!sections.length)
    return wrapped

  return `${wrapped}\n\n<skill_resources>\n${sections.map(file => `- ${file}`).join('\n')}\n</skill_resources>`
}

function loadSkillFromMetadataFile(skillDir: string, metadataPath: string): LoadedSkill | null {
  try {
    const raw = JSON.parse(readFileSync(metadataPath, 'utf-8'))
    const metadata = validateMetadata(raw, metadataPath)
    if (!metadata)
      return null

    if (!isSafeRelativePath(metadata.entry)) {
      logger.warn(`[skill-loader] Invalid metadata.entry for ${metadata.name}: ${metadata.entry}`)
      return null
    }

    const entryPath = normalize(join(skillDir, metadata.entry))
    if (!existsSync(entryPath) || !statSync(entryPath).isFile()) {
      logger.warn(`[skill-loader] Skill entry not found for ${metadata.name}: ${entryPath}`)
      return null
    }

    const prompt = buildStandardPrompt(metadata.name, readFileSync(entryPath, 'utf-8'), skillDir)

    logger.info(`[skill-loader] Loaded standard skill: ${metadata.name}`)
    return {
      name: metadata.name,
      version: metadata.version,
      description: metadata.description,
      prompt,
      dir: skillDir,
      tools: [],
    }
  }
  catch (err) {
    logger.error(`[skill-loader] Failed to parse metadata at ${metadataPath}:`, err)
    return null
  }
}

function loadSkillFromDir(skillDir: string): LoadedSkill | null {
  const metadataPath = join(skillDir, 'metadata.json')
  const manifestPath = join(skillDir, 'skill.json')
  const mdPath = join(skillDir, 'SKILL.md')

  if (existsSync(metadataPath))
    return loadSkillFromMetadataFile(skillDir, metadataPath)

  // legacy fallback
  if (existsSync(manifestPath))
    return loadSkillFromJsonFile(manifestPath, skillDir)
  if (existsSync(mdPath))
    return loadSkillFromMdFile(mdPath, skillDir)

  return null
}

function loadSkillFromJsonFile(manifestPath: string, skillDir: string): LoadedSkill | null {
  try {
    const raw = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    const manifest = validateManifest(raw, manifestPath)

    if (!manifest)
      return null

    if (manifest.disabled) {
      logger.info(`[skill-loader] Skill disabled: ${manifest.name} (${manifestPath})`)
      return null
    }

    const configFieldKeys = (manifest.config ?? []).map(f => f.key)
    const tools = buildTools(manifest.tools ?? [], skillDir, manifest.name, configFieldKeys)

    logger.info(`[skill-loader] Loaded legacy skill from dir (json): ${manifest.name} (${tools.length} tools)`)

    return {
      name: manifest.name,
      version: manifest.version ?? '1.0.0',
      description: manifest.description,
      prompt: manifest.prompt,
      dir: skillDir,
      tools,
    }
  }
  catch (err) {
    logger.error(`[skill-loader] Failed to parse manifest at ${manifestPath}:`, err)
    return null
  }
}

function loadSkillFromMdFile(mdPath: string, skillDir: string): LoadedSkill | null {
  try {
    const raw = readFileSync(mdPath, 'utf-8')
    const parsed = matter(raw)
    const fm = parsed.data as Partial<SkillMdFrontmatter>

    const name = (typeof fm.name === 'string' && fm.name.trim())
      ? fm.name.trim()
      : basename(skillDir)

    if (typeof fm.description !== 'string' || !fm.description.trim()) {
      logger.warn(`[skill-loader] SKILL.md at ${mdPath} missing "description" in frontmatter`)
      return null
    }

    if (fm.disabled === true) {
      logger.info(`[skill-loader] Skill disabled: ${name} (${mdPath})`)
      return null
    }

    const version = fm.metadata?.version ?? '1.0.0'
    const prompt = parsed.content.trim() || undefined

    logger.info(`[skill-loader] Loaded legacy skill from SKILL.md: ${name}`)

    return {
      name,
      version,
      description: fm.description.trim(),
      prompt,
      dir: skillDir,
      tools: [],
    }
  }
  catch (err) {
    logger.error(`[skill-loader] Failed to parse SKILL.md at ${mdPath}:`, err)
    return null
  }
}

function loadSkillFromFile(filePath: string): LoadedSkill | null {
  const ext = extname(filePath).toLowerCase()

  if (ext === '.json')
    return loadSkillFromJsonStandalone(filePath)
  if (ext === '.md')
    return loadSkillFromMdFile(filePath, join(filePath, '..'))

  return null
}

function loadSkillFromJsonStandalone(filePath: string): LoadedSkill | null {
  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8'))
    const manifest = validateManifest(raw, filePath)

    if (!manifest)
      return null

    if (manifest.disabled) {
      logger.info(`[skill-loader] Skill disabled: ${manifest.name} (${filePath})`)
      return null
    }

    if (manifest.tools?.length) {
      logger.warn(
        `[skill-loader] Single-file skill "${manifest.name}" in ${filePath} declares tools, but they are ignored. Use a directory-based skill instead.`,
      )
    }

    const skillDir = join(filePath, '..')

    logger.info(`[skill-loader] Loaded skill from file: ${manifest.name}`)

    return {
      name: manifest.name,
      version: manifest.version ?? '1.0.0',
      description: manifest.description,
      prompt: manifest.prompt,
      dir: skillDir,
      tools: [],
    }
  }
  catch (err) {
    logger.error(`[skill-loader] Failed to parse skill file ${filePath}:`, err)
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
      let skill: LoadedSkill | null = null

      if (stat.isDirectory()) {
        skill = loadSkillFromDir(fullPath)
      }
      else if (stat.isFile()) {
        const ext = extname(entry).toLowerCase()
        const fname = basename(entry)
        if (ext === '.json') {
          skill = loadSkillFromFile(fullPath)
        }
        else if (ext === '.md' && fname !== 'README.md') {
          skill = loadSkillFromFile(fullPath)
        }
      }

      if (!skill)
        continue

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
