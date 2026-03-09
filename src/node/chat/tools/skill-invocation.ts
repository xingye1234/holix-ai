import type { DynamicStructuredTool } from '@langchain/core/tools'
import { DynamicStructuredTool as DynamicStructuredToolImpl } from '@langchain/core/tools'
import { recordSkillInvocation } from '../../database/skill-invocation-log'
import { logger } from '../../platform/logger'

export function wrapWithSkillInvocationLog(tool: DynamicStructuredTool, skillName: string): DynamicStructuredTool {
  const originalFunc = (tool as any).func as (...args: any[]) => Promise<string>

  return new DynamicStructuredToolImpl({
    name: tool.name,
    description: tool.description,
    schema: tool.schema,
    func: async (input: Record<string, unknown>) => {
      try {
        const result = await originalFunc(input)
        recordSkillInvocation({
          skillName,
          toolName: tool.name,
          args: input,
          result,
          rejected: false,
        })
        return result
      }
      catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.warn(`[skill-invocation] Tool "${tool.name}" failed: ${message}`)
        recordSkillInvocation({
          skillName,
          toolName: tool.name,
          args: input,
          rejected: false,
          error: message,
        })
        throw err
      }
    },
  })
}
