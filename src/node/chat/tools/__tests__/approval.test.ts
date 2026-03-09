/**
 * Tool Approval 流程测试
 *
 * 测试覆盖：
 * 1. 白名单（始终允许 / 本次对话允许）时直接执行，不触发渲染进程弹窗
 * 2. 不在白名单时，调用 updateAwait 发起弹窗并等待
 * 3. updateAwait 返回 true 时执行 tool 并返回结果
 * 4. updateAwait 返回 false 时返回拒绝消息
 * 5. updateAwait 抛异常时视为拒绝
 */

import type { DynamicStructuredTool } from '@langchain/core/tools'
import { DynamicStructuredTool as DynamicStructuredToolImpl } from '@langchain/core/tools'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import z from 'zod'

// 现在安全导入被测模块
import { wrapWithApproval } from '../approval'

// ─── 主进程审批状态（必须在导入被测模块前 mock）──────────────────────────────────

const mockApprovalState = vi.hoisted(() => ({
  isApproved: vi.fn<() => boolean>(() => false),
  isAlwaysAllowed: vi.fn<() => boolean>(() => false),
  setAlwaysAllow: vi.fn(),
  removeAlwaysAllow: vi.fn(),
  setSessionAllowAll: vi.fn(),
  setSessionAllowSkill: vi.fn(),
}))

vi.mock('../approval-state', () => ({
  approvalState: mockApprovalState,
}))

// ─── updateAwait（SSE callback 弹窗机制）─────────────────────────────────────

const mockUpdateAwait = vi.hoisted(() => vi.fn<() => Promise<boolean>>())

const mockKvGet = vi.hoisted(() => vi.fn<(key: string) => unknown>())
const mockKvSet = vi.hoisted(() => vi.fn())
const mockKvDelete = vi.hoisted(() => vi.fn())

vi.mock('../../../platform/update', () => ({
  updateAwait: (...args: unknown[]) => mockUpdateAwait(...(args as Parameters<typeof mockUpdateAwait>)),
  update: vi.fn(),
}))

vi.mock('../../../database/kv-operations', () => ({
  kvGet: (key: string) => mockKvGet(key),
  kvSet: (key: string, value: unknown) => mockKvSet(key, value),
  kvDelete: (key: string) => mockKvDelete(key),
  kvDeletePrefix: vi.fn(),
  kvSetObject: vi.fn(),
  kvGetObject: vi.fn(),
}))

vi.mock('../../../platform/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const mockRecordSkillInvocation = vi.hoisted(() => vi.fn())

vi.mock('../../../database/skill-invocation-log', () => ({
  recordSkillInvocation: (...args: unknown[]) => mockRecordSkillInvocation(...(args as Parameters<typeof mockRecordSkillInvocation>)),
}))

// ─── 辅助：构造一个简单的 DynamicStructuredTool ────────────────────────────────

function makeDummyTool(
  name: string,
  fn: (input: Record<string, unknown>) => Promise<string>,
): DynamicStructuredTool {
  return new DynamicStructuredToolImpl({
    name,
    description: `Test tool: ${name}`,
    schema: z.object({ input: z.string().optional() }),
    func: fn,
  })
}

// ─── 测试 ─────────────────────────────────────────────────────────────────────

describe('wrapWithApproval - 白名单自动允许', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('isApproved 返回 true（始终允许）时直接执行，不调用 updateAwait', async () => {
    mockApprovalState.isApproved.mockReturnValue(true)
    mockApprovalState.isAlwaysAllowed.mockReturnValue(true)

    const fn = vi.fn(async () => 'executed!')
    const tool = makeDummyTool('my_tool', fn)
    const wrapped = wrapWithApproval(tool, 'my_skill')

    const result = await wrapped.invoke({ input: 'hello' })

    expect(result).toBe('executed!')
    expect(mockUpdateAwait).not.toHaveBeenCalled()
    expect(fn).toHaveBeenCalledOnce()
  })

  it('isApproved 返回 true（本次对话允许）时直接执行，不调用 updateAwait', async () => {
    mockApprovalState.isApproved.mockReturnValue(true)
    mockApprovalState.isAlwaysAllowed.mockReturnValue(false)

    const fn = vi.fn(async () => 'session allowed')
    const tool = makeDummyTool('session_tool', fn)
    const wrapped = wrapWithApproval(tool, 'my_skill')

    const result = await wrapped.invoke({})

    expect(result).toBe('session allowed')
    expect(mockUpdateAwait).not.toHaveBeenCalled()
  })

  it('isApproved 以 skillName 参数被调用', async () => {
    mockApprovalState.isApproved.mockReturnValue(true)
    mockApprovalState.isAlwaysAllowed.mockReturnValue(true)

    const tool = makeDummyTool('t', async () => 'ok')
    const wrapped = wrapWithApproval(tool, 'target_skill')

    await wrapped.invoke({})

    expect(mockApprovalState.isApproved).toHaveBeenCalledWith('target_skill')
  })
})

describe('wrapWithApproval - 需要用户审批', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApprovalState.isApproved.mockReturnValue(false)
    mockApprovalState.isAlwaysAllowed.mockReturnValue(false)
  })

  it('不在白名单时调用 updateAwait 发起审批请求', async () => {
    mockUpdateAwait.mockResolvedValue(true)
    const fn = vi.fn(async () => 'approved result')
    const tool = makeDummyTool('risky_tool', fn)
    const wrapped = wrapWithApproval(tool, 'risky_skill')

    await wrapped.invoke({ input: 'data' })

    expect(mockUpdateAwait).toHaveBeenCalledOnce()
    expect(mockUpdateAwait).toHaveBeenCalledWith(
      'tool.approval.request',
      expect.objectContaining({
        toolName: 'risky_tool',
        skillName: 'risky_skill',
        args: expect.objectContaining({ input: 'data' }),
      }),
    )
  })

  it('用户批准时执行 tool 并返回执行结果', async () => {
    mockUpdateAwait.mockResolvedValue(true)
    const fn = vi.fn(async () => 'approved output')
    const tool = makeDummyTool('approved_tool', fn)
    const wrapped = wrapWithApproval(tool, 'my_skill')

    const result = await wrapped.invoke({})

    expect(result).toBe('approved output')
    expect(fn).toHaveBeenCalledOnce()
  })

  it('用户拒绝（返回 false）时不执行 tool，返回拒绝提示字符串', async () => {
    mockUpdateAwait.mockResolvedValue(false)
    const fn = vi.fn(async () => 'should not run')
    const tool = makeDummyTool('denied_tool', fn)
    const wrapped = wrapWithApproval(tool, 'my_skill')

    const result = await wrapped.invoke({})

    expect(fn).not.toHaveBeenCalled()
    expect(result).toContain('拒绝')
    expect(result).toContain('denied_tool')
    expect(mockRecordSkillInvocation).toHaveBeenCalledWith(expect.objectContaining({
      skillName: 'my_skill',
      toolName: 'denied_tool',
      rejected: true,
    }))
  })

  it('updateAwait 抛异常时视为拒绝，不执行 tool', async () => {
    mockUpdateAwait.mockRejectedValue(new Error('SSE channel closed'))
    const fn = vi.fn(async () => 'should not run')
    const tool = makeDummyTool('error_tool', fn)
    const wrapped = wrapWithApproval(tool, 'my_skill')

    const result = await wrapped.invoke({})

    expect(fn).not.toHaveBeenCalled()
    expect(typeof result).toBe('string')
    expect(result).toContain('拒绝')
  })

  it('审批载荷包含 tool 描述', async () => {
    mockUpdateAwait.mockResolvedValue(true)
    const tool = makeDummyTool('described_tool', async () => 'ok')
    const wrapped = wrapWithApproval(tool, 'skill_x')

    await wrapped.invoke({})

    expect(mockUpdateAwait).toHaveBeenCalledWith(
      'tool.approval.request',
      expect.objectContaining({
        description: expect.stringContaining('described_tool'),
      }),
    )
  })
})

// ─── approval-state.ts 单元测试 ───────────────────────────────────────────────

describe('approvalState（直接单元测试）', () => {
  // 单独导入真实实现（不 mock）
  // 注意：需要 mock kv-operations 以避免 Electron 依赖链

  // 使用真实的 approval-state（不走上面的 vi.mock）— 需要单独 import
  // 这里通过动态 import 绕过模块缓存
  let realApprovalState: typeof import('../approval-state')['approvalState']

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await vi.importActual<typeof import('../approval-state')>('../approval-state')
    realApprovalState = mod.approvalState
    realApprovalState._reset()
  })

  it('isApproved：KV 中有始终允许记录时返回 true', () => {
    mockKvGet.mockReturnValue(true)
    expect(realApprovalState.isApproved('my_skill')).toBe(true)
  })

  it('isApproved：KV 中没有记录且未设置会话允许时返回 false', () => {
    mockKvGet.mockReturnValue(undefined)
    expect(realApprovalState.isApproved('my_skill')).toBe(false)
  })

  it('setSessionAllowAll 后 isApproved 对任意 skill 返回 true', () => {
    mockKvGet.mockReturnValue(undefined)
    realApprovalState.setSessionAllowAll()
    expect(realApprovalState.isApproved('any_skill')).toBe(true)
    expect(realApprovalState.isApproved('other_skill')).toBe(true)
  })

  it('setSessionAllowSkill 后 isApproved 对该 skill 返回 true，其他不受影响', () => {
    mockKvGet.mockReturnValue(undefined)
    realApprovalState.setSessionAllowSkill('allowed_skill')
    expect(realApprovalState.isApproved('allowed_skill')).toBe(true)
    expect(realApprovalState.isApproved('other_skill')).toBe(false)
  })

  it('setAlwaysAllow 调用 kvSet 写入正确的 key', () => {
    realApprovalState.setAlwaysAllow('target_skill')
    expect(mockKvSet).toHaveBeenCalledWith(
      'tool.approval.always_allow.target_skill',
      true,
    )
  })

  it('removeAlwaysAllow 调用 kvDelete 删除正确的 key', () => {
    realApprovalState.removeAlwaysAllow('target_skill')
    expect(mockKvDelete).toHaveBeenCalledWith(
      'tool.approval.always_allow.target_skill',
    )
  })

  it('_reset 清除所有会话级状态', () => {
    mockKvGet.mockReturnValue(undefined)
    realApprovalState.setSessionAllowAll()
    realApprovalState._reset()
    expect(realApprovalState.isApproved('any_skill')).toBe(false)
  })
})
