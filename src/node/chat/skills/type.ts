import type { DynamicStructuredTool } from '@langchain/core/tools'
import type { SandboxPermissions } from './sandbox/types'

// ─── Skill Manifest (skill.json) ──────────────────────────────────────────────

/** JS 文件工具声明：从指定 JS 文件加载 LangChain tools */
export interface JsToolDeclaration {
  type: 'js'
  /** 相对于 skill 目录的 JS 文件路径 */
  file: string
  /** 导出名称，默认 'default'，支持具名导出或默认导出 */
  export?: string
  /**
   * 沙箱权限配置。
   *
   * 不配置则使用最严格的默认权限：
   * - 不允许任何 require()
   * - 不暴露任何 process.env
   * - 10 秒超时，64MB 内存上限
   */
  permissions?: SandboxPermissions
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
  /**
   * 用户可配置项声明。
   * 配置值持久化存储在 ky 表（key: `skill.{name}.config.{field.key}`）。
   * Skill tools 在运行时可通过 skillConfig 全局对象（JS 沙箱）或
   * {{config.KEY}} 模板变量（command/script 类型）访问这些值。
   */
  config?: SkillConfigField[]
}

/**
 * Skill 用户可配置项字段定义
 *
 * 示例（skill.json 中）：
 * ```json
 * "config": [
 *   { "key": "apiKey", "label": "API Key", "type": "string", "secret": true, "required": true },
 *   { "key": "model",  "label": "模型",     "type": "select",
 *     "options": [{ "label": "GPT-4o", "value": "gpt-4o" }], "default": "gpt-4o" }
 * ]
 * ```
 */
export interface SkillConfigField {
  /** 配置项 key（存储时拼接为 `skill.{skillName}.config.{key}`） */
  key: string
  /** 在设置界面显示的标签 */
  label: string
  /** 输入类型 */
  type: 'string' | 'number' | 'boolean' | 'select'
  /** 详细描述，显示在输入框下方 */
  description?: string
  /** 输入框占位文本（string 类型有效） */
  placeholder?: string
  /** 是否必填 */
  required?: boolean
  /** 是否为密钥（显示为密码框，不明文展示） */
  secret?: boolean
  /** 默认值 */
  default?: string | number | boolean
  /** select 类型的选项列表 */
  options?: Array<{ label: string, value: string }>
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
  /** 从此 Skill 实例化的 LangChain tools（高风险工具已自动包裹审批拦截器） */
  tools: DynamicStructuredTool[]
}

// ─── Legacy Interface (for backward compatibility) ────────────────────────────

/** @deprecated 使用 SkillManifest 替代 */
export interface Skill {
  name: string
  description: string
  prompt: string
}

// ─── Markdown SKILL.md (antfu/skills format) ──────────────────────────────────

/**
 * SKILL.md frontmatter，兼容 https://github.com/antfu/skills 格式。
 *
 * 文件格式：
 * ```md
 * ---
 * name: vite
 * description: Vite build tool...
 * metadata:
 *   author: Anthony Fu
 *   version: "2026.1.31"
 *   source: https://...
 * ---
 *
 * # Vite
 * ...（Markdown 正文作为 system prompt 注入）
 * ```
 */
export interface SkillMdFrontmatter {
  /** Skill 唯一标识 */
  name: string
  /** 简短描述，告知 AI 何时使用此知识 */
  description: string
  /** 可选元数据（作者、版本、来源等） */
  metadata?: {
    author?: string
    version?: string
    source?: string
    [key: string]: unknown
  }
  /** 是否禁用，默认 false */
  disabled?: boolean
}
