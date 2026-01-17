import { z } from 'zod'
import {
  createChat,
  getAllChats,
  getChatByUid,
  updateChat,
  updateChatModel,
  updateChatPrompts,
  updateChatWorkspace,
} from '../database/chat-operations'
import { update } from '../platform/update'
import { procedure, router } from './trpc'

// 定义聊天相关的 procedures
export const chatRouter = router({
  // 创建会话
  create: procedure()
    .input(
      z.object({
        provider: z.string(),
        model: z.string(),
        title: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const chat = await createChat({
        provider: input.provider,
        model: input.model,
        title: input.title,
      })
      return chat
    }),

  // 获取会话详情
  getById: procedure()
    .input(
      z.object({
        chatUid: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const chat = await getChatByUid(input.chatUid)
      if (!chat) {
        throw new Error(`Chat not found: ${input.chatUid}`)
      }
      return chat
    }),

  // 更新模型
  updateModel: procedure()
    .input(
      z.object({
        chatUid: z.string(),
        model: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      await updateChatModel(input.chatUid, input.model)
      return { success: true }
    }),

  // 更新会话信息（通用）
  update: procedure()
    .input(
      z.object({
        uid: z.string(),
        provider: z.string().optional(),
        model: z.string().optional(),
        title: z.string().optional(),
        status: z.enum(['active', 'archived', 'error']).optional(),
        pinned: z.boolean().optional(),
        archived: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { uid, ...updates } = input
      const chat = await updateChat(uid, updates)
      return chat
    }),

  // 列出所有会话（无参数）
  list: procedure().query(async () => {
    return await getAllChats()
  }),

  // 更新提示词列表
  updatePrompts: procedure()
    .input(
      z.object({
        chatUid: z.string(),
        prompts: z.array(z.string()),
      }),
    )
    .mutation(async ({ input }) => {
      const chat = await updateChatPrompts(input.chatUid, input.prompts)
      update('chat.updated', chat)
      return chat
    }),

  // 更新工作区配置
  updateWorkspace: procedure()
    .input(
      z.object({
        chatUid: z.string(),
        workspace: z.array(
          z.object({
            type: z.literal('directory'),
            value: z.string(),
          }),
        ).nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const chat = await updateChatWorkspace(input.chatUid, input.workspace)
      // 通知渲染线程更新
      update('chat.updated', chat)
      return chat
    }),
})
