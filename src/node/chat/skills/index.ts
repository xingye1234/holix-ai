/**
 * Skills 模块公共 API
 *
 * 用法示例：
 * ```ts
 * import { skillManager } from './skills'
 *
 * // 初始化（应用启动时调用一次）
 * skillManager.initialize()
 * skillManager.watch()
 *
 * // 会话中获取所有 tools
 * const tools = skillManager.getAllTools()
 *
 * // 获取系统提示词
 * const prompts = skillManager.getSystemPrompts()
 * ```
 */

import { skillManager } from './manager'

export { getSkillsDir, scanSkillsDir } from './loader'
export { skillManager } from './manager'
export type {
  LoadedSkill,
  SkillConfigField,
  StandardSkillMetadata,
} from './type'
