/**
 * Skills 模块公共 API
 *
 * 用法示例：
 * ```ts
 * import { skillManager, listSkills, getSkill } from './skills'
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
  CommandToolDeclaration,
  JsToolDeclaration,
  LoadedSkill,
  SchemaField,
  ScriptToolDeclaration,
  Skill,
  SkillManifest,
  ToolDeclaration,
} from './type'

// ─── 便捷函数（兼容旧接口）──────────────────────────────────────────────────────

/**
 * 列出所有已加载的 skill 信息
 * @deprecated 直接使用 skillManager.listSkills()
 */
export function listSkills() {
  return skillManager.listSkills().map(s => ({
    name: s.name,
    description: s.description,
    prompt: s.prompt ?? '',
  }))
}

/**
 * 按名称获取 skill 的 prompt
 * @deprecated 直接使用 skillManager.getSkill(name)
 */
export function getSkill(name: string) {
  const skill = skillManager.getSkill(name)
  if (!skill)
    return undefined

  return {
    name: skill.name,
    description: skill.description,
    prompt: skill.prompt ?? '',
  }
}

