import { DynamicStructuredTool as DynamicStructuredToolImpl } from '@langchain/core/tools'
import { describe, expect, it, vi } from 'vitest'
import z from 'zod'
import { wrapWithSkillInvocationLog } from '../skill-invocation'

const mockRecordSkillInvocation = vi.hoisted(() => vi.fn())

vi.mock('../../../database/skill-invocation-log', () => ({
  recordSkillInvocation: (...args: unknown[]) => mockRecordSkillInvocation(...(args as Parameters<typeof mockRecordSkillInvocation>)),
}))

vi.mock('../../../platform/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

describe('wrapWithSkillInvocationLog', () => {
  it('记录成功调用的参数和结果', async () => {
    const tool = new DynamicStructuredToolImpl({
      name: 'hello_tool',
      description: 'hello',
      schema: z.object({ name: z.string() }),
      func: async (input: Record<string, unknown>) => `hello ${input.name}`,
    })

    const wrapped = wrapWithSkillInvocationLog(tool, 'demo_skill')
    const result = await wrapped.invoke({ name: 'codex' })

    expect(result).toBe('hello codex')
    expect(mockRecordSkillInvocation).toHaveBeenCalledWith({
      skillName: 'demo_skill',
      toolName: 'hello_tool',
      args: { name: 'codex' },
      result: 'hello codex',
      rejected: false,
    })
  })
})
