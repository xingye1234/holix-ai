/**
 * JS Adapter：将 skill.json 中的 JS 工具声明转换为 LangChain DynamicStructuredTool
 *
 * 安全模型
 * ─────────────────────────────────────────────────────────────────
 * 扫描阶段（无 JS 执行）：
 *   - 仅读取 skill.json，从中取得工具的 name / description / schema
 *   - 不执行任何 JS 文件，不引入任何副作用
 *   - 脚本文件仅做存在性检查（warn），不执行
 *
 * 执行阶段（worker_threads + vm 双重隔离）：
 *   - 每次 invoke() 启动一个独立 Worker 线程
 *   - Worker 内用 vm.runInContext() 运行文件，按 `name` 字段找到对应的 execute()
 *   - 通过 skill.json 的 permissions 精确控制可用模块和 env key
 *   - 超时 / 内存超限后 Worker 自动终止
 *
 * JS 脚本格式（skill.json 中 name 必须与此匹配）：
 * ```js
 * module.exports = {
 *   name: 'my_tool',   // 与 skill.json 同名
 *   execute: async ({ input }) => `结果: ${input}`
 * }
 * // 或导出数组（多工具共用一个文件）
 * module.exports = [tool1, tool2]
 * ```
 */

import type { DynamicStructuredTool } from '@langchain/core/tools'
import type { JsToolDeclaration, SchemaField } from '../type'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tool } from 'langchain'
import z from 'zod'
import { getSkillConfig } from '../../../database/skill-config'
import { logger } from '../../../platform/logger'
import { runInSandbox } from '../sandbox/executor'
import { auditJsSource } from './source-audit'

// ─── Schema 构建 ───────────────────────────────────────────────────────────────

// ─── Schema 构建 ──────────────────────────────────────────────────────────────

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

// ─── 脚本路径解析 ─────────────────────────────────────────────────────────────

/**
 * 解析脚本文件的绝对路径。
 * 先尝试与 skill.json 同级，再尝试 scripts/ 子目录。
 * 若均不存在则返回 null。
 */
function resolveScriptPath(skillDir: string, file: string): string | null {
  const direct = join(skillDir, file)
  if (existsSync(direct))
    return direct
  const inScripts = join(skillDir, 'scripts', file)
  if (existsSync(inScripts))
    return inScripts
  return null
}

// ─── 公共 API ──────────────────────────────────────────────────────────────────

/**
 * 将 skill.json 中的一条 JsToolDeclaration 转换为 LangChain DynamicStructuredTool。
 *
 * - 扫描阶段：仅检查文件是否存在，不执行任何 JS
 * - 执行阶段：在 Worker + vm 双重沙箱中运行脚本
 *
 * @param declaration    JsToolDeclaration（来自 skill.json），包含 name/description/schema
 * @param skillDir       Skill 目录绝对路径
 * @param skillName      归属 skill 的名称，用于运行时读取用户配置
 * @param configFieldKeys manifest.config 中声明的字段 key 列表
 */
export function loadJsTools(
  declaration: JsToolDeclaration,
  skillDir: string,
  skillName: string,
  configFieldKeys: string[] = [],
): DynamicStructuredTool[] {
  const filePath = resolveScriptPath(skillDir, declaration.file)

  if (!filePath) {
    logger.warn(
      `[js-adapter] Script not found: "${declaration.file}" `
      + `(tried ${join(skillDir, declaration.file)} and ${join(skillDir, 'scripts', declaration.file)})`,
    )
    return []
  }

  const audit = auditJsSource(filePath, declaration.permissions)
  if (!audit.safe) {
    logger.warn(
      `[js-adapter] Blocked tool "${declaration.name}" from "${filePath}" due to static audit issues:\n${
        audit.issues
          .map(issue => `  - line ${issue.line}: ${issue.message}${issue.snippet ? ` (${issue.snippet})` : ''}`)
          .join('\n')}`,
    )
    return []
  }

  const exportName = declaration.export ?? 'default'
  const permissions = declaration.permissions ?? {}
  const zodSchema = buildZodSchema(declaration.schema)

  const langchainTool = tool(
    async (args: Record<string, any>) => {
      logger.info(`[js-adapter] Executing tool "${declaration.name}" from "${filePath}"`)

      // 每次调用时从 KV 中读取最新配置，确保用户修改立即生效
      const skillConfig = configFieldKeys.length > 0
        ? getSkillConfig(skillName, configFieldKeys)
        : {}

      try {
        const result = await runInSandbox({
          filePath,
          toolName: declaration.name,
          exportName,
          args,
          permissions,
          skillConfig,
        })

        logger.info(`[js-adapter] Tool "${declaration.name}" completed, result length: ${result.length}`)
        return result
      }
      catch (err: any) {
        const msg = err?.message ?? String(err)
        logger.error(`[js-adapter] Tool "${declaration.name}" sandbox error:`, err)
        return `Error executing tool "${declaration.name}": ${msg}`
      }
    },
    {
      name: declaration.name,
      description: declaration.description,
      schema: zodSchema,
    },
  ) as unknown as DynamicStructuredTool

  const permSummary = permissions.allowedBuiltins?.length
    ? `allowedBuiltins=[${permissions.allowedBuiltins.join(',')}]`
    : 'no builtins'
  logger.info(
    `[js-adapter] Registered tool "${declaration.name}" from "${declaration.file}" [sandbox: ${permSummary}]`,
  )

  return [langchainTool]
}
