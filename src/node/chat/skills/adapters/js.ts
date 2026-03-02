/**
 * JS Adapter：从 .js 文件动态加载 LangChain DynamicStructuredTool
 *
 * JS 文件格式规范：
 * ```js
 * // 导出单个 tool 定义或数组
 * module.exports = [
 *   {
 *     name: 'my_tool',
 *     description: '工具描述',
 *     schema: { input: { type: 'string', description: '输入内容' } },
 *     execute: async ({ input }) => `处理结果: ${input}`
 *   }
 * ]
 * // 或导出单个 tool
 * module.exports = {
 *   name: 'my_tool',
 *   description: '工具描述',
 *   execute: async ({ input }) => 'result'
 * }
 * ```
 */

import type { DynamicStructuredTool } from '@langchain/core/tools'
import type { JsToolDeclaration, SchemaField } from '../type'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { tool } from 'langchain'
import z from 'zod'
import { logger } from '../../../platform/logger'

/** 用户 JS 文件中 tool 定义的结构 */
interface JsToolDefinition {
  name: string
  description: string
  /** 简化 schema：{ paramName: SchemaField | 'string' | 'number' | 'boolean' } */
  schema?: Record<string, SchemaField | string>
  execute: (args: Record<string, any>) => Promise<any> | any
}

/**
 * 将简化 schema 转换为 Zod schema
 */
function buildZodSchema(schema?: Record<string, SchemaField | string>): z.ZodObject<any> {
  if (!schema || Object.keys(schema).length === 0)
    return z.object({})

  const shape: Record<string, z.ZodTypeAny> = {}

  for (const [key, field] of Object.entries(schema)) {
    const fieldDef: SchemaField = typeof field === 'string'
      ? { type: field as SchemaField['type'] }
      : field

    let zodType: z.ZodTypeAny

    switch (fieldDef.type) {
      case 'number':
        zodType = z.number()
        break
      case 'boolean':
        zodType = z.boolean()
        break
      default:
        zodType = z.string()
    }

    if (fieldDef.description)
      zodType = zodType.describe(fieldDef.description)

    shape[key] = fieldDef.optional ? zodType.optional() : zodType
  }

  return z.object(shape)
}

/**
 * 将单个 JsToolDefinition 转换为 LangChain DynamicStructuredTool
 */
function definitionToTool(def: JsToolDefinition, _skillDir: string): DynamicStructuredTool {
  const zodSchema = buildZodSchema(def.schema)

  return tool(
    async (args: Record<string, any>) => {
      try {
        const result = await def.execute(args)
        return typeof result === 'string' ? result : JSON.stringify(result)
      }
      catch (err: any) {
        logger.error(`[js-adapter] Tool "${def.name}" execution error:`, err)
        return `Error executing tool "${def.name}": ${err?.message ?? String(err)}`
      }
    },
    {
      name: def.name,
      description: def.description,
      schema: zodSchema,
    },
  ) as unknown as DynamicStructuredTool
}

/**
 * 从 JS 文件加载 LangChain tools
 * @param declaration JsToolDeclaration 声明
 * @param skillDir skill 所在目录
 */
export function loadJsTools(declaration: JsToolDeclaration, skillDir: string): DynamicStructuredTool[] {
  const filePath = join(skillDir, declaration.file)

  if (!existsSync(filePath)) {
    logger.warn(`[js-adapter] JS tool file not found: ${filePath}`)
    return []
  }

  try {
    // 使用 createRequire 以支持 ESM 环境下动态 require
    const requireFn = createRequire(import.meta.url)

    // 清除模块缓存以支持热重载
    delete requireFn.cache[requireFn.resolve(filePath)]

    const mod = requireFn(filePath)
    const exportName = declaration.export ?? 'default'

    let exported: JsToolDefinition | JsToolDefinition[]

    // 处理不同的导出形式
    if (exportName === 'default') {
      exported = mod?.default ?? mod
    }
    else {
      exported = mod[exportName]
    }

    if (!exported) {
      logger.warn(`[js-adapter] No export "${exportName}" found in ${filePath}`)
      return []
    }

    const definitions: JsToolDefinition[] = Array.isArray(exported) ? exported : [exported]

    const tools = definitions
      .filter((def) => {
        if (!def?.name || !def?.execute) {
          logger.warn(`[js-adapter] Invalid tool definition in ${filePath}: missing "name" or "execute"`)
          return false
        }
        return true
      })
      .map(def => definitionToTool(def, skillDir))

    logger.info(`[js-adapter] Loaded ${tools.length} tool(s) from ${filePath}`)
    return tools
  }
  catch (err: any) {
    logger.error(`[js-adapter] Failed to load JS tools from ${filePath}:`, err)
    return []
  }
}
