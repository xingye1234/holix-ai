/**
 * JS Adapter：从 .js 文件加载 LangChain DynamicStructuredTool（沙箱版）
 *
 * 安全模型
 * ─────────────────────────────────────────────────────────────────
 * 加载阶段（主进程，vm 沙箱）：
 *   - 读取文件内容，在 vm.runInNewContext() 中执行
 *   - 上下文只包含无副作用的安全全局（JSON、Math、Date 等）
 *   - require / process / electron API 完全不可见
 *   - 只提取 tool 的名称、描述、schema（纯数据，无函数引用）
 *
 * 执行阶段（worker_threads + vm 双重隔离）：
 *   - 每次 invoke() 启动一个独立 Worker 线程
 *   - Worker 内再次用 vm.runInContext() 运行 execute()
 *   - 通过 skill.json 中的 permissions 精确控制可用的模块和 env key
 *   - 超时 / 内存超限后 Worker 自动终止
 *
 * JS 文件格式规范（不变）：
 * ```js
 * module.exports = {
 *   name: 'my_tool',
 *   description: '工具描述',
 *   schema: { input: { type: 'string', description: '输入' } },
 *   execute: async ({ input }) => `结果: ${input}`
 * }
 * // 或导出数组
 * module.exports = [tool1, tool2]
 * ```
 */

import type { DynamicStructuredTool } from '@langchain/core/tools'
import type { JsToolDeclaration, SchemaField } from '../type'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'
import { tool } from 'langchain'
import z from 'zod'
import { logger } from '../../../platform/logger'
import { runInSandbox } from '../sandbox/executor'

// ─── 纯数据元数据（仅用于注册 tool，不含 execute 函数引用）─────────────────────

interface ToolMeta {
  name: string
  description: string
  schema?: Record<string, SchemaField | string>
}

// ─── Schema 构建 ───────────────────────────────────────────────────────────────

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

// ─── 加载阶段：vm 沙箱解析元数据（主进程，无副作用）─────────────────────────────

/**
 * 在 vm 沙箱中解析 JS 文件，只提取元数据（name/description/schema）。
 * 不执行任何 execute() 函数，require / process 完全不可见。
 */
function parseToolMeta(filePath: string, exportName: string): ToolMeta[] {
  const code = readFileSync(filePath, 'utf-8')

  const moduleExports: Record<string, any> = {}
  const moduleObj = { exports: moduleExports }

  const context = vm.createContext({
    module: moduleObj,
    exports: moduleExports,
    // require 在元数据解析阶段返回空对象（execute 中的 require 在沙箱执行阶段才生效）
    require: (_: string) => ({}),
    process: Object.freeze({
      platform: process.platform,
      arch: process.arch,
      version: process.version,
      env: Object.freeze({}),
    }),
    // 安全 JS 全局
    JSON,
    Math,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    TypeError,
    RangeError,
    Promise,
    Map,
    Set,
    Symbol,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    console: { log: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    // 明确屏蔽危险全局
    eval: undefined,
    Function: undefined,
    Buffer: undefined,
    setTimeout: undefined,
    setInterval: undefined,
    setImmediate: undefined,
  })

  try {
    vm.runInContext(code, context, {
      filename: filePath,
      timeout: 3_000,
    })
  }
  catch (err: any) {
    throw new Error(`Failed to parse skill file "${filePath}": ${err?.message}`)
  }

  const mod = moduleObj.exports
  const target = exportName === 'default'
    ? (mod?.default ?? mod)
    : mod?.[exportName]

  if (!target)
    return []

  const items: any[] = Array.isArray(target) ? target : [target]

  return items
    .filter((item) => {
      if (!item || typeof item.name !== 'string' || !item.name.trim()) {
        logger.warn(`[js-adapter] Skipping tool in "${filePath}": missing "name"`)
        return false
      }
      if (typeof item.description !== 'string') {
        logger.warn(`[js-adapter] Skipping tool "${item.name}" in "${filePath}": missing "description"`)
        return false
      }
      return true
    })
    .map(item => ({
      name: item.name as string,
      description: item.description as string,
      schema: item.schema as Record<string, SchemaField | string> | undefined,
    }))
}

// ─── 执行阶段：为每个 tool 创建沙箱化的 LangChain tool ────────────────────────

function metaToSandboxedTool(
  meta: ToolMeta,
  declaration: JsToolDeclaration,
  skillDir: string,
): DynamicStructuredTool {
  const filePath = join(skillDir, declaration.file)
  const exportName = declaration.export ?? 'default'
  const permissions = declaration.permissions ?? {}
  const zodSchema = buildZodSchema(meta.schema)

  return tool(
    async (args: Record<string, any>) => {
      logger.info(`[js-adapter] Executing tool "${meta.name}" in sandbox`)

      try {
        const result = await runInSandbox({
          filePath,
          toolName: meta.name,
          exportName,
          args,
          permissions,
        })

        logger.info(`[js-adapter] Tool "${meta.name}" completed, result length: ${result.length}`)
        return result
      }
      catch (err: any) {
        const msg = err?.message ?? String(err)
        logger.error(`[js-adapter] Tool "${meta.name}" sandbox error:`, err)
        return `Error executing tool "${meta.name}": ${msg}`
      }
    },
    {
      name: meta.name,
      description: meta.description,
      schema: zodSchema,
    },
  ) as unknown as DynamicStructuredTool
}

// ─── 公共 API ──────────────────────────────────────────────────────────────────

/**
 * 从 JS 文件加载 LangChain tools（沙箱版）
 *
 * 加载阶段在 vm 沙箱内解析元数据；执行阶段在独立 Worker 线程沙箱中运行。
 *
 * @param declaration JsToolDeclaration（来自 skill.json）
 * @param skillDir    Skill 目录绝对路径
 */
export function loadJsTools(declaration: JsToolDeclaration, skillDir: string): DynamicStructuredTool[] {
  const filePath = join(skillDir, declaration.file)

  if (!existsSync(filePath)) {
    logger.warn(`[js-adapter] JS tool file not found: ${filePath}`)
    return []
  }

  let metas: ToolMeta[]

  try {
    metas = parseToolMeta(filePath, declaration.export ?? 'default')
  }
  catch (err: any) {
    logger.error(`[js-adapter] Failed to parse tool metadata from "${filePath}":`, err)
    return []
  }

  if (metas.length === 0) {
    logger.warn(`[js-adapter] No valid tool definitions found in "${filePath}"`)
    return []
  }

  const permissions = declaration.permissions ?? {}
  const permSummary = permissions.allowedBuiltins?.length
    ? `allowedBuiltins=[${permissions.allowedBuiltins.join(',')}]`
    : 'no builtins'

  logger.info(
    `[js-adapter] Loaded ${metas.length} tool(s) from "${filePath}" [sandbox: ${permSummary}]`,
  )

  return metas.map(meta => metaToSandboxedTool(meta, declaration, skillDir))
}

