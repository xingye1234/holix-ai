/**
 * Command/Script Adapter：将 Shell 命令 / 外部脚本包装为 LangChain DynamicStructuredTool
 *
 * 命令模板支持 {{paramName}} 变量替换，以及 {{skillDir}} 内置变量。
 *
 * 示例 skill.json 中的 command tool：
 * ```json
 * {
 *   "type": "command",
 *   "name": "run_tests",
 *   "description": "Run project test suite",
 *   "command": "npm test --testPathPattern={{pattern}}",
 *   "cwd": "{{dir}}",
 *   "timeout": 60000,
 *   "schema": {
 *     "pattern": { "type": "string", "description": "Test file pattern" },
 *     "dir":     { "type": "string", "description": "Project directory" }
 *   }
 * }
 * ```
 */

import type { DynamicStructuredTool } from '@langchain/core/tools'
import type { CommandToolDeclaration, SchemaField, ScriptToolDeclaration } from '../type'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { tool } from 'langchain'
import z from 'zod'
import { logger } from '../../../platform/logger'

const execAsync = promisify(exec)

const DEFAULT_TIMEOUT = 30_000

/**
 * 模板替换：{{key}} → args[key]，{{skillDir}} → skillDir
 */
function renderTemplate(template: string, args: Record<string, any>, skillDir: string): string {
  return template
    .replace(/\{\{skillDir\}\}/g, skillDir)
    .replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const val = args[key]
      return val !== undefined ? String(val) : `{{${key}}}`
    })
}

/**
 * 将简化 schema 构建为 Zod schema
 */
function buildZodSchema(schema?: Record<string, SchemaField>): z.ZodObject<any> {
  if (!schema || Object.keys(schema).length === 0)
    return z.object({})

  const shape: Record<string, z.ZodTypeAny> = {}

  for (const [key, field] of Object.entries(schema)) {
    let zodType: z.ZodTypeAny

    switch (field.type) {
      case 'number':
        zodType = z.number()
        break
      case 'boolean':
        zodType = z.boolean()
        break
      default:
        zodType = z.string()
    }

    if (field.description)
      zodType = zodType.describe(field.description)

    shape[key] = field.optional ? zodType.optional() : zodType
  }

  return z.object(shape)
}

/**
 * 执行命令并返回结果字符串
 */
async function runCommand(
  command: string,
  cwd: string,
  timeout: number,
): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout,
      maxBuffer: 1024 * 1024 * 4, // 4MB
    })

    const out = stdout.trim()
    const err = stderr.trim()

    if (err && !out)
      return `stderr: ${err}`

    return err ? `stdout: ${out}\nstderr: ${err}` : out
  }
  catch (error: any) {
    if (error.killed && error.signal === 'SIGTERM')
      return `Command timed out after ${timeout}ms`

    const stderr = error.stderr?.trim() ?? ''
    const stdout = error.stdout?.trim() ?? ''
    const msg = stderr || stdout || error.message

    return `Command failed (exit ${error.code ?? 'unknown'}): ${msg}`
  }
}

/**
 * 从 CommandToolDeclaration 创建 LangChain tool
 */
export function commandToTool(declaration: CommandToolDeclaration, skillDir: string): DynamicStructuredTool {
  const zodSchema = buildZodSchema(declaration.schema)
  const timeout = declaration.timeout ?? DEFAULT_TIMEOUT

  return tool(
    async (args: Record<string, any>) => {
      const command = renderTemplate(declaration.command, args, skillDir)
      const cwd = declaration.cwd
        ? renderTemplate(declaration.cwd, args, skillDir)
        : skillDir

      logger.info(`[command-adapter] Executing: ${command}`, { cwd, name: declaration.name })

      const result = await runCommand(command, cwd, timeout)

      logger.info(`[command-adapter] "${declaration.name}" completed, output length: ${result.length}`)
      return result
    },
    {
      name: declaration.name,
      description: declaration.description,
      schema: zodSchema,
    },
  ) as unknown as DynamicStructuredTool
}

/**
 * 从 ScriptToolDeclaration 创建 LangChain tool
 * Script 类型与 Command 类型相同，只是 key 字段名为 "script"
 */
export function scriptToTool(declaration: ScriptToolDeclaration, skillDir: string): DynamicStructuredTool {
  const zodSchema = buildZodSchema(declaration.schema)
  const timeout = declaration.timeout ?? DEFAULT_TIMEOUT

  return tool(
    async (args: Record<string, any>) => {
      const command = renderTemplate(declaration.script, args, skillDir)
      const cwd = declaration.cwd
        ? renderTemplate(declaration.cwd, args, skillDir)
        : skillDir

      logger.info(`[command-adapter] Executing script: ${command}`, { cwd, name: declaration.name })

      const result = await runCommand(command, cwd, timeout)

      logger.info(`[command-adapter] Script "${declaration.name}" completed, output length: ${result.length}`)
      return result
    },
    {
      name: declaration.name,
      description: declaration.description,
      schema: zodSchema,
    },
  ) as unknown as DynamicStructuredTool
}
