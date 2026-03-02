import type { DynamicStructuredTool } from '@langchain/core/tools'

// ─── Skill Manifest (skill.json) ──────────────────────────────────────────────

/** JS 文件工具声明：从指定 JS 文件加载 LangChain tools */
export interface JsToolDeclaration {
  type: 'js'
  /** 相对于 skill 目录的 JS 文件路径 */
  file: string
  /** 导出名称，默认 'default'，支持具名导出或默认导出 */
  export?: string
}

/** Shell 命令工具声明：将命令包装为 LangChain tool */
export interface CommandToolDeclaration {
  type: 'command'
  /** Tool 名称（snake_case） */
  name: string
  /** Tool 描述，告知 AI 何时调用 */
  description: string
  /** 要执行的命令，支持 {{param}} 模板变量 */
  command: string
  /** 工作目录，支持 {{skillDir}} 变量，默认 skill 目录 */
  cwd?: string
  /** 超时毫秒数，默认 30000 */
  timeout?: number
  /** Zod schema 参数声明（简化形式） */
  schema?: Record<string, SchemaField>
}

/** 脚本工具声明：执行外部脚本（python/bash 等） */
export interface ScriptToolDeclaration {
  type: 'script'
  /** Tool 名称（snake_case） */
  name: string
  /** Tool 描述 */
  description: string
  /** 脚本命令，支持 {{skillDir}} 和 {{param}} 模板变量 */
  script: string
  /** 工作目录，默认 skill 目录 */
  cwd?: string
  /** 超时毫秒数，默认 30000 */
  timeout?: number
  /** 参数 schema */
  schema?: Record<string, SchemaField>
}

/** 简化的 schema 字段定义 */
export interface SchemaField {
  type: 'string' | 'number' | 'boolean'
  description?: string
  optional?: boolean
}

export type ToolDeclaration = JsToolDeclaration | CommandToolDeclaration | ScriptToolDeclaration

/** skill.json 清单文件格式 */
export interface SkillManifest {
  /** Skill 唯一标识（snake_case），默认取目录名 */
  name: string
  /** 版本号 */
  version?: string
  /** 简短描述 */
  description: string
  /** 注入 System Prompt 的附加内容（可多行） */
  prompt?: string
  /** 是否禁用此 skill，默认 false */
  disabled?: boolean
  /** Tool 声明列表 */
  tools?: ToolDeclaration[]
}

// ─── Runtime Skill ────────────────────────────────────────────────────────────

/** 运行时 Skill 对象（已加载） */
export interface LoadedSkill {
  /** Skill 名称（来自 manifest） */
  name: string
  /** Skill 版本 */
  version: string
  /** Skill 描述 */
  description: string
  /** 系统提示词追加内容 */
  prompt?: string
  /** Skill 所在目录的绝对路径 */
  dir: string
  /** 从此 Skill 实例化的 LangChain tools */
  tools: DynamicStructuredTool[]
}

// ─── Legacy Interface (for backward compatibility) ────────────────────────────

/** @deprecated 使用 SkillManifest 替代 */
export interface Skill {
  name: string
  description: string
  prompt: string
}
