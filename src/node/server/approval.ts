import z from 'zod'
import { approvalState } from '../chat/tools/approval-state'
import { procedure, router } from './trpc'

export const approvalRouter = router({
  /** 设置"始终允许"某 skill（持久化到 KV） */
  setAlwaysAllow: procedure()
    .input(z.object({ skillName: z.string() }))
    .mutation(({ input }) => {
      approvalState.setAlwaysAllow(input.skillName)
    }),

  /** 移除"始终允许" */
  removeAlwaysAllow: procedure()
    .input(z.object({ skillName: z.string() }))
    .mutation(({ input }) => {
      approvalState.removeAlwaysAllow(input.skillName)
    }),

  /** 本次对话全部允许（进程内存，重启后清空） */
  setSessionAllowAll: procedure()
    .mutation(() => {
      approvalState.setSessionAllowAll()
    }),

  /** 本次对话允许某个 skill（进程内存，重启后清空） */
  setSessionAllowSkill: procedure()
    .input(z.object({ skillName: z.string() }))
    .mutation(({ input }) => {
      approvalState.setSessionAllowSkill(input.skillName)
    }),
})
