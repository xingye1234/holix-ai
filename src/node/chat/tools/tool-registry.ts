/**
 * 工具注册表
 * 管理会话可用的基础工具注册
 */

import type { DynamicStructuredTool } from '@langchain/core/tools'
import { configStore } from '../../platform/config'
import { logger } from '../../platform/logger'
import { skillManager } from '../../skills/manager'
import { chatKeywordSearchTool, chatTimeSearchTool } from './chat'
import { context7Tool } from './context7'
import { systemEnvTool, systemPlatformTool, systemTimeTool, systemTimezoneTool } from './system'

/**
 * 工具注册表配置
 */
export interface ToolRegistryConfig {
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

    // Context7 工具（可选）
    const context7Tools = (context7ApiKey && this.config.enableContext7)
      ? [context7Tool]
      : []

    const tools = [
      ...systemTools,
      ...chatTools,
      ...context7Tools,
    ]

    logger.info(`[ToolRegistry] Built ${tools.length} tools`)

    return tools
  }

  /**
   * 获取 Skill System Prompts
   */
  getSkillSystemPrompts(): string[] {
    return this.getEnabledSkills()
      .filter(s => s.prompt)
      .map(s => `[Skill: ${s.name}]\n${s.prompt}`)
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
