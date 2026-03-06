/**
 * SkillLoader：扫描 .holixai/skills/ 目录，解析所有合法的 skill 清单并构建 LoadedSkill 对象
 *
 * 目录布局支持两种形式：
 *
 * 形式一：目录型 skill（推荐，支持 tools）
 * ```
 * ~/.holixai/skills/
 * └── my-skill/
 *     ├── skill.json        ← 清单（必须）
 *     ├── tools.js          ← 可选 JS tools
 *     └── scripts/          ← 可选脚本目录
 *         └── run.sh
 * ```
 *
 * 形式二：单文件 skill（仅 prompt，无 tools）
 * ```
 * ~/.holixai/skills/
 * └── simple-skill.json     ← 清单文件（直接放在 skills 目录）
 * ```
 */

import type { DynamicStructuredTool } from '@langchain/core/tools'
import type { LoadedSkill, SkillManifest, SkillMdFrontmatter, ToolDeclaration } from './type'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import matter from 'gray-matter'
import { logger } from '../../platform/logger'
import { wrapWithApproval } from '../tools/approval'
import { commandToTool, scriptToTool } from './adapters/command'
import { loadJsTools } from './adapters/js'
import { requiresApprovalForPermissions } from './sandbox/types'

// ─── Schema 验证 ──────────────────────────────────────────────────────────────

/**
 * 简单验证 manifest 字段合法性（不引入额外 schema 库依赖）
 */
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

// ─── Tool 构建 ─────────────────────────────────────────────────────────────────

/**
 * 根据工具声明列表构建 LangChain tools
 */
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
            tools.push(...jsTools.map(t => wrapWithApproval(t, skillName)))
          }
          else {
            tools.push(...jsTools)
          }
          break
        }
        case 'command':
          tools.push(wrapWithApproval(commandToTool(decl, skillDir, skillName, configFieldKeys), skillName))
          break
        case 'script':
          tools.push(wrapWithApproval(scriptToTool(decl, skillDir, skillName, configFieldKeys), skillName))
          break
        default:
          logger.warn(`[skill-loader] Unknown tool type: ${(decl as any).type}`)
      }
    }
    catch (err) {
      logger.error(`[skill-loader] Failed to build tool from declaration:`, decl, err)
    }
  }

  return tools
}

// ─── 单个 Skill 加载 ──────────────────────────────────────────────────────────

/**
 * 从目录型 skill 加载：优先 skill.json，其次 SKILL.md（antfu/skills 格式）
 */
function loadSkillFromDir(skillDir: string): LoadedSkill | null {
  const manifestPath = join(skillDir, 'skill.json')
  const mdPath = join(skillDir, 'SKILL.md')

  if (existsSync(manifestPath)) {
    return loadSkillFromJsonFile(manifestPath, skillDir)
  }
  else if (existsSync(mdPath)) {
    return loadSkillFromMdFile(mdPath, skillDir)
  }

  return null
}

/**
 * 从 skill.json 加载目录型 skill
 */
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

    logger.info(
      `[skill-loader] Loaded skill from dir (json): ${manifest.name} (${tools.length} tools)`,
    )

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

/**
 * 从 SKILL.md 文件加载知识型 skill（antfu/skills 格式）。
 *
 * 文件格式：
 * ```md
 * ---
 * name: vite
 * description: Vite build tool...
 * metadata:
 *   author: Anthony Fu
 *   version: "2026.1.31"
 * ---
 *
 * # Vite
 * ...（Markdown 正文直接作为 system prompt 注入）
 * ```
 *
 * @param mdPath  SKILL.md 的绝对路径
 * @param skillDir skill 所在目录（可为文件所在目录）
 */
function loadSkillFromMdFile(mdPath: string, skillDir: string): LoadedSkill | null {
  try {
    const raw = readFileSync(mdPath, 'utf-8')
    const parsed = matter(raw)
    const fm = parsed.data as Partial<SkillMdFrontmatter>

    // name 可从 frontmatter 获取，fallback 到目录/文件名
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
    // Markdown 正文作为 system prompt（去掉首尾空白）
    const prompt = parsed.content.trim() || undefined

    logger.info(`[skill-loader] Loaded skill from SKILL.md: ${name}`)

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

/**
 * 从单文件型 skill 加载（.json 文件放在 skills 根目录）
 */
function loadSkillFromFile(filePath: string): LoadedSkill | null {
  const ext = extname(filePath).toLowerCase()

  if (ext === '.json') {
    return loadSkillFromJsonStandalone(filePath)
  }
  else if (ext === '.md') {
    return loadSkillFromMdFile(filePath, join(filePath, '..'))
  }

  return null
}

/**
 * 从独立 .json 文件加载（无 tools 支持）
 */
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

    // 单文件 skill 不支持 tools（没有任意文件的相对路径上下文）
    if (manifest.tools?.length) {
      logger.warn(
        `[skill-loader] Single-file skill "${manifest.name}" in ${filePath} declares tools, but they are ignored. Use a directory-based skill instead.`,
      )
    }

    // 单文件型技能的 dir 取文件所在目录
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

// ─── 全量扫描 ──────────────────────────────────────────────────────────────────

/**
 * 扫描指定目录并返回所有合法的 LoadedSkill 列表
 * @param skillsDir .holixai/skills 目录的绝对路径
 */
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
        // 目录型 skill：skill.json 优先，其次 SKILL.md
        skill = loadSkillFromDir(fullPath)
      }
      else if (stat.isFile()) {
        const ext = extname(entry).toLowerCase()
        const fname = basename(entry)
        if (ext === '.json') {
          // 单文件型 skill（.json）
          skill = loadSkillFromFile(fullPath)
        }
        else if (ext === '.md' && fname !== 'README.md') {
          // 独立 SKILL.md（或任意 .md skill 文件，跳过 README）
          skill = loadSkillFromFile(fullPath)
        }
      }

      if (skill) {
        if (nameSet.has(skill.name)) {
          logger.warn(
            `[skill-loader] Duplicate skill name "${skill.name}", skipping entry "${entry}"`,
          )
          continue
        }
        nameSet.add(skill.name)
        skills.push(skill)
      }
    }
    catch (err) {
      logger.error(`[skill-loader] Error processing entry "${entry}":`, err)
    }
  }

  logger.info(`[skill-loader] Scanned "${skillsDir}": found ${skills.length} skill(s)`)
  return skills
}

/**
 * 生成 skills 目录路径（相对于 userDataDir）
 */
export function getSkillsDir(userDataDir: string): string {
  return join(userDataDir, 'skills')
}
