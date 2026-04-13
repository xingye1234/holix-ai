import { DynamicStructuredTool as DynamicStructuredToolImpl } from '@langchain/core/tools'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import z from 'zod'
import { wrapWithSkillInvocationLog } from '../skill-invocation'

const mockRecordSkillInvocation = vi.hoisted(() => vi.fn())

vi.mock('../../../database/skill-invocation-log', () => ({
  recordSkillInvocation: (...args: unknown[]) => mockRecordSkillInvocation(...(args as Parameters<typeof mockRecordSkillInvocation>)),
}))

describe('wrapWithSkillInvocationLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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

  it('记录失败调用的参数和错误，保持异常继续抛出', async () => {
    const tool = new DynamicStructuredToolImpl({
      name: 'failing_tool',
      description: 'fail',
      schema: z.object({ value: z.string() }),
      func: async () => {
        throw new Error('boom')
      },
    })

    const wrapped = wrapWithSkillInvocationLog(tool, 'demo_skill')

    await expect(wrapped.invoke({ value: 'x' })).rejects.toThrow('boom')

    expect(mockRecordSkillInvocation).toHaveBeenCalledWith({
      skillName: 'demo_skill',
      toolName: 'failing_tool',
      args: { value: 'x' },
      rejected: false,
      error: 'boom',
    })
  })
})
