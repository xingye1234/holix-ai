/**
 * 标准技能元数据（metadata.json）
 */
export interface StandardSkillMetadata {
  name: string
  version: string
  description: string
  author?: string
  tags?: string[]
  entry: string
  allowedTools?: string[]
  config?: SkillConfigField[]
}

/**
 * Skill 用户可配置项字段定义
 */
export interface SkillConfigField {
  key: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'select'
  description?: string
  placeholder?: string
  required?: boolean
  secret?: boolean
  default?: string | number | boolean
  options?: Array<{ label: string, value: string }>
}

/**
 * 运行时 Skill 对象（已加载）
 */
export interface LoadedSkill {
  name: string
  version: string
  description: string
  prompt?: string
  dir: string
  allowedTools: string[]
  config: SkillConfigField[]
}
