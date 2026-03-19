/**
 * 工具注册表
 * 管理工具的动态加载和注册（为渐进式 Skills 加载做准备）
 */

import type { DynamicStructuredTool } from '@langchain/core/tools'
import { configStore } from '../../platform/config'
import { logger } from '../../platform/logger'
import { skillManager } from '../skills/manager'
import { chatKeywordSearchTool, chatTimeSearchTool } from './chat'
import { context7Tool } from './context7'
import { buildLoadSkillTool, reloadSkillsTool } from './skills'
import { systemEnvTool, systemPlatformTool, systemTimeTool, systemTimezoneTool } from './system'

/**
 * 工具加载策略
 */
export type ToolLoadingStrategy = 'eager' | 'lazy' | 'smart'

/**
 * 工具注册表配置
 */
export interface ToolRegistryConfig {
  /** 加载策略 */
  strategy: ToolLoadingStrategy

  /** 核心 Skills（始终加载） */
  coreSkills?: string[]

  /** 是否启用 Context7 */
  enableContext7?: boolean

  /** 全局禁用的 Skills */
  disabledSkills?: string[]
}

/**
 * 工具注册表
 */
export class ToolRegistry {
  private config: ToolRegistryConfig

  constructor(config?: Partial<ToolRegistryConfig>) {
    this.config = {
      strategy: config?.strategy || 'eager', // 默认保持现有行为
      coreSkills: config?.coreSkills || [],
      enableContext7: config?.enableContext7 ?? true,
      disabledSkills: config?.disabledSkills || [],
    }
  }

  /**
   * 构建工具列表
   */
  buildTools(): DynamicStructuredTool[] {
    const context7ApiKey = configStore.get('context7ApiKey')

    // 系统工具（始终加载）
    const systemTools = [
      systemPlatformTool,
      systemEnvTool,
      systemTimezoneTool,
      systemTimeTool,
    ]

    // 聊天工具（始终加载）
    const chatTools = [
      chatTimeSearchTool,
      chatKeywordSearchTool,
    ]

    // Skill 管理工具（始终加载）
    const enabledSkillNames = this.getEnabledSkills().map(s => s.name)
    const skillManagementTools = [
      buildLoadSkillTool(enabledSkillNames.length > 0 ? { enabledSkillNames } : undefined),
      reloadSkillsTool,
    ]

    // Context7 工具（可选）
    const context7Tools = (context7ApiKey && this.config.enableContext7)
      ? [context7Tool]
      : []

    // Skill 工具（根据策略加载）
    const skillTools = this.loadSkillTools()

    const tools = [
      ...systemTools,
      ...chatTools,
      ...skillManagementTools,
      ...context7Tools,
      ...skillTools,
    ]

    logger.info(`[ToolRegistry] Built ${tools.length} tools (strategy=${this.config.strategy}, skill_tools=${skillTools.length})`)

    return tools
  }

  /**
   * 根据策略加载 Skill 工具
   */
  private loadSkillTools(): DynamicStructuredTool[] {
    switch (this.config.strategy) {
      case 'eager':
        // 加载所有 Skill 工具（当前行为）
        return this.loadAllSkillTools()

      case 'lazy':
        // 不加载任何 Skill 工具（完全渐进式）
        return []

      case 'smart':
        // 只加载核心 Skills 的工具
        return this.loadCoreSkillTools()

      default:
        return this.loadAllSkillTools()
    }
  }

  /**
   * 加载所有 Skill 工具
   */
  private loadAllSkillTools(): DynamicStructuredTool[] {
    const enabledSkills = this.getEnabledSkills()
    const tools = enabledSkills.length > 0
      ? enabledSkills.flatMap(skill => skill.tools)
      : skillManager.getAllTools()
    logger.debug(`[ToolRegistry] Loaded all skill tools: ${tools.length}`)
    return tools
  }

  /**
   * 加载核心 Skills 的工具
   */
  private loadCoreSkillTools(): DynamicStructuredTool[] {
    const coreSkills = this.config.coreSkills || []
    const tools: DynamicStructuredTool[] = []

    for (const skillName of coreSkills) {
      const skill = skillManager.getSkill(skillName)
      if (skill && !this.isSkillDisabled(skill.name)) {
        tools.push(...skill.tools)
        logger.debug(`[ToolRegistry] Loaded core skill: ${skillName} (${skill.tools.length} tools)`)
      }
      else {
        logger.warn(`[ToolRegistry] Core skill not found: ${skillName}`)
      }
    }

    logger.info(`[ToolRegistry] Loaded ${tools.length} core skill tools from ${coreSkills.length} skills`)
    return tools
  }

  /**
   * 获取 Skill System Prompts（根据策略）
   */
  getSkillSystemPrompts(): string[] {
    switch (this.config.strategy) {
      case 'eager':
        // 加载所有 Skill prompts（当前行为）
        return skillManager.getSystemPrompts()

      case 'lazy': {
        // 渐进式加载：只提供 skills 摘要，让 AI 使用 load_skill 工具按需加载
        const summary = skillManager.getSkillsSummary()
          .filter(s => !this.isSkillDisabled(s.name))
        if (summary.length === 0) {
          return []
        }

        const skillsList = summary
          .map(s => `- ${s.name}: ${s.description}`)
          .join('\n')

        return [`
# Available Skills

You have access to the following skills. Use the \`load_skill\` tool to load a skill's full instructions when needed:

${skillsList}

**Note**: Skills are loaded on-demand. When you need to use a skill's capabilities, call \`load_skill\` with the skill name to get its complete instructions.
`.trim()]
      }

      case 'smart':
        // 只加载核心 Skills 的 prompts
        return this.getCoreSkillPrompts()

      default:
        return this.getEnabledSkills().length > 0
          ? this.getEnabledSkills().filter(s => s.prompt).map(s => `[Skill: ${s.name}]\n${s.prompt}`)
          : skillManager.getSystemPrompts()
    }
  }

  /**
   * 获取核心 Skills 的 System Prompts
   */
  private getCoreSkillPrompts(): string[] {
    const coreSkills = this.config.coreSkills || []
    const prompts: string[] = []

    for (const skillName of coreSkills) {
      const skill = skillManager.getSkill(skillName)
      if (skill && !this.isSkillDisabled(skill.name) && skill.prompt) {
        prompts.push(`[Skill: ${skill.name}]\n${skill.prompt}`)
      }
    }

    return prompts
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ToolRegistryConfig>): void {
    this.config = { ...this.config, ...config }
    logger.info(`[ToolRegistry] Config updated: ${JSON.stringify(this.config)}`)
  }

  /**
   * 获取当前配置
   */
  getConfig(): ToolRegistryConfig {
    return { ...this.config }
  }

  private isSkillDisabled(skillName: string): boolean {
    return (this.config.disabledSkills || []).includes(skillName)
  }

  private getEnabledSkills() {
    const skills = (skillManager as any).listSkills?.() ?? []
    return skills.filter((skill: any) => !this.isSkillDisabled(skill.name))
  }
}

// 导出工厂函数
export function createToolRegistry(config?: Partial<ToolRegistryConfig>): ToolRegistry {
  return new ToolRegistry(config)
}

// 导出默认实例（保持向后兼容）
export const toolRegistry = new ToolRegistry()
