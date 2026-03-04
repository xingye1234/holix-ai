/**
 * SkillManager：Skills 运行时单例
 *
 * 职责：
 * - 启动时扫描 .holixai/skills/ 目录
 * - 缓存已加载的 skills
 * - 提供热重载（reload）能力
 * - 监听目录变更（可选，按需加载）
 * - 为每次会话提供 LangChain tools 和 system prompt 内容
 */

import type { DynamicStructuredTool } from '@langchain/core/tools'
import type { FSWatcher } from 'node:fs'
import type { LoadedSkill } from './type'
import { existsSync, mkdirSync, watch } from 'node:fs'
import { APP_DATA_PATH, BUILTIN_SKILLS_PATH } from '../../constant'
import { logger } from '../../platform/logger'
import { wrapWithApproval } from '../tools/approval'
import { getSkillsDir, scanSkillsDir } from './loader'

class SkillManager {
  private skills: Map<string, LoadedSkill> = new Map()
  private skillsDir: string
  private builtinSkillsDir: string
  private watcher: FSWatcher | null = null
  private reloadDebounceTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    this.skillsDir = getSkillsDir(APP_DATA_PATH)
    this.builtinSkillsDir = BUILTIN_SKILLS_PATH
    this.ensureSkillsDir()
  }

  // ─── 初始化 ──────────────────────────────────────────────────────────────────

  /**
   * 初始化加载：扫描并缓存所有 skills
   */
  initialize(): void {
    this.reload()
    logger.info(`[SkillManager] Initialized with ${this.skills.size} skill(s) from ${this.skillsDir}`)
  }

  /**
   * 重新扫描并加载所有 skills（清空缓存后全量重载）
   * 加载顺序：内置 skills → 用户 skills（用户同名 skill 可覆盖内置）
   */
  reload(): void {
    this.skills.clear()

    // 1. 先加载内置 skills（应用自带）
    if (existsSync(this.builtinSkillsDir)) {
      const builtinSkills = scanSkillsDir(this.builtinSkillsDir)
      for (const skill of builtinSkills) {
        this.skills.set(skill.name, skill)
      }
      logger.info(`[SkillManager] Loaded ${builtinSkills.length} built-in skill(s) from ${this.builtinSkillsDir}`)
    }
    else {
      logger.debug(`[SkillManager] Built-in skills dir not found (not compiled yet?): ${this.builtinSkillsDir}`)
    }

    // 2. 加载用户 skills（同名时覆盖内置 skill）
    const userSkills = scanSkillsDir(this.skillsDir)
    for (const skill of userSkills) {
      if (this.skills.has(skill.name)) {
        logger.info(`[SkillManager] User skill "${skill.name}" overrides built-in skill`)
      }
      this.skills.set(skill.name, skill)
    }

    logger.info(`[SkillManager] Reloaded: ${this.skills.size} total skill(s)`)
  }

  /**
   * 启动目录监听，文件变更时自动 debounce 重载
   * @param debounceMs 防抖毫秒数，默认 1000ms
   */
  watch(debounceMs = 1_000): void {
    if (this.watcher) {
      logger.debug('[SkillManager] Already watching')
      return
    }

    if (!existsSync(this.skillsDir)) {
      logger.debug(`[SkillManager] Skills dir not found, skip watch: ${this.skillsDir}`)
      return
    }

    try {
      this.watcher = watch(this.skillsDir, { recursive: true }, (event, filename) => {
        logger.debug(`[SkillManager] File change detected: ${event} ${filename}`)
        this.scheduleReload(debounceMs)
      })

      this.watcher.on('error', (err) => {
        logger.error('[SkillManager] Watcher error:', err)
      })

      logger.info(`[SkillManager] Watching for changes in ${this.skillsDir}`)
    }
    catch (err) {
      logger.warn('[SkillManager] Could not start file watcher:', err)
    }
  }

  /**
   * 停止目录监听
   */
  unwatch(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
      logger.info('[SkillManager] Stopped watching')
    }
    if (this.reloadDebounceTimer) {
      clearTimeout(this.reloadDebounceTimer)
      this.reloadDebounceTimer = null
    }
  }

  // ─── 查询 API ─────────────────────────────────────────────────────────────────

  /**
   * 获取所有已加载的 skills
   */
  listSkills(): LoadedSkill[] {
    return Array.from(this.skills.values())
  }

  /**
   * 按名称获取单个 skill
   */
  getSkill(name: string): LoadedSkill | undefined {
    return this.skills.get(name)
  }

  /**
   * 收集所有 skills 提供的 LangChain tools（用于注入 agent）
   * 高风险 skill 的工具将被自动包装审批拦截器
   */
  getAllTools(): DynamicStructuredTool[] {
    const tools: DynamicStructuredTool[] = []
    for (const skill of this.skills.values()) {
      if (skill.dangerous) {
        // 高风险 skill：所有工具包装审批拦截器
        tools.push(...skill.tools.map(t => wrapWithApproval(t, skill.name)))
      }
      else {
        tools.push(...skill.tools)
      }
    }
    return tools
  }

  /**
   * 收集所有 skills 的 system prompt 内容
   * 按 skill 名称排序后合并，方便调试
   */
  getSystemPrompts(): string[] {
    return Array.from(this.skills.values())
      .filter(s => s.prompt)
      .map(s => `[Skill: ${s.name}]\n${s.prompt}`)
  }

  /**
   * 获取 skills 目录路径
   */
  getSkillsDir(): string {
    return this.skillsDir
  }

  /**
   * 返回当前加载的 skill 数量
   */
  get size(): number {
    return this.skills.size
  }

  // ─── 私有工具 ─────────────────────────────────────────────────────────────────

  private ensureSkillsDir(): void {
    if (!existsSync(this.skillsDir)) {
      try {
        mkdirSync(this.skillsDir, { recursive: true })
        logger.info(`[SkillManager] Created skills directory: ${this.skillsDir}`)
      }
      catch (err) {
        logger.warn(`[SkillManager] Could not create skills directory: ${this.skillsDir}`, err)
      }
    }
  }

  private scheduleReload(debounceMs: number): void {
    if (this.reloadDebounceTimer)
      clearTimeout(this.reloadDebounceTimer)

    this.reloadDebounceTimer = setTimeout(() => {
      logger.info('[SkillManager] Auto-reloading skills due to file change...')
      this.reload()
      this.reloadDebounceTimer = null
    }, debounceMs)
  }
}

// 全局单例
export const skillManager = new SkillManager()
