/**
 * Skill 用户配置存取工具
 *
 * 所有 skill 配置统一存储在 ky 表，key 命名规则：
 *   `skill.{skillName}.config.{fieldKey}`
 *
 * 例：skill `my_skill` 的 `apiKey` 字段 → `skill.my_skill.config.apiKey`
 */

import { kvDeletePrefix, kvGet, kvSet } from './kv-operations'

// ─── key 命名工具 ─────────────────────────────────────────────────────────────

export function skillConfigKey(skillName: string, fieldKey: string): string {
  return `skill.${skillName}.config.${fieldKey}`
}

export function skillConfigPrefix(skillName: string): string {
  return `skill.${skillName}.config`
}

// ─── 读写操作 ──────────────────────────────────────────────────────────────────

/**
 * 读取单个配置项的值。未配置时返回 `undefined`。
 */
export function getSkillConfigField<T = unknown>(skillName: string, fieldKey: string): T | undefined {
  return kvGet<T>(skillConfigKey(skillName, fieldKey))
}

/**
 * 写入单个配置项的值。
 */
export function setSkillConfigField(skillName: string, fieldKey: string, value: unknown): void {
  kvSet(skillConfigKey(skillName, fieldKey), value)
}

/**
 * 读取某个 skill 的所有配置项，返回 `{ fieldKey: value }` 的平铺对象。
 * 需要传入字段 key 列表（来自 manifest.config）以避免全表扫描。
 */
export function getSkillConfig(
  skillName: string,
  fieldKeys: string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const key of fieldKeys) {
    const val = getSkillConfigField(skillName, key)
    if (val !== undefined)
      result[key] = val
  }
  return result
}

/**
 * 读取某个 skill 的所有配置项（需要传入字段 key 列表）。
 * @deprecated 直接使用 getSkillConfig
 */
export function getSkillConfigFields(
  skillName: string,
  fieldKeys: string[],
): Record<string, unknown> {
  return getSkillConfig(skillName, fieldKeys)
}

/**
 * 删除某个 skill 的全部配置（重置）。
 */
export function deleteSkillConfig(skillName: string): void {
  kvDeletePrefix(skillConfigPrefix(skillName))
}
