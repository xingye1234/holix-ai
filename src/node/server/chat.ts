import { z } from 'zod'
import logger from '@/lib/logger'
import {
  cleanupExpiredChats,
  createChat,
  deleteChat,
  getAllChats,
  getChatByUid,
  searchChats,
  updateChat,
  updateChatContextSettings,
  updateChatModel,
  updateChatPrompts,
  updateChatWorkspace,
  updatePendingMessages,
} from '../database/chat-operations'
import { getChatSkillSettings, setChatSkillSettings } from '../database/chat-skill-settings'
import { update } from '../platform/update'
import { procedure, router } from './trpc'

const contextSettingsSchema = z.object({
  maxMessages: z.number().int().min(1).max(200),
  timeWindowHours: z.number().int().min(1).max(24 * 30).nullable(),
  autoScrollToBottomOnSend: z.boolean().default(true),
})

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
        expiresAt: z.number().nullable().optional(),
        contextSettings: contextSettingsSchema.optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { uid, ...updates } = input
      const chat = await updateChat(uid, updates)
      update('chat.updated', {
        chatUid: chat.uid,
        updates,
      })
      return chat
    }),

  // 列出所有会话（无参数）
  list: procedure().query(async () => {
    const expiredChatUids = await cleanupExpiredChats()
    expiredChatUids.forEach((uid) => {
      update('chat.deleted', { uid })
    })

    return await getAllChats()
  }),

  search: procedure()
    .input(
      z.object({
        keyword: z.string(),
        limit: z.number().optional(),
        offset: z.number().optional(),
        includeArchived: z.boolean().optional(),
      }),
    )
    .query(async ({ input }) => {
      return await searchChats({
        query: input.keyword,
        limit: input.limit,
        offset: input.offset,
        includeArchived: input.includeArchived,
      })
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

  // 更新聊天上下文设置
  updateContextSettings: procedure()
    .input(
      z.object({
        chatUid: z.string(),
        contextSettings: contextSettingsSchema,
      }),
    )
    .mutation(async ({ input }) => {
      const chat = await updateChatContextSettings(input.chatUid, input.contextSettings)
      update('chat.updated', chat)
      return chat
    }),

  getSkillSettings: procedure()
    .input(z.object({ chatUid: z.string() }))
    .query(({ input }) => {
      return getChatSkillSettings(input.chatUid)
    }),

  updateSkillSettings: procedure()
    .input(
      z.object({
        chatUid: z.string(),
        disabledSkills: z.array(z.string()),
        enabledSkills: z.array(z.string()),
      }),
    )
    .mutation(({ input }) => {
      return setChatSkillSettings(input.chatUid, {
        disabledSkills: input.disabledSkills,
        enabledSkills: input.enabledSkills,
      })
    }),

  // 更新工作区配置
  updateWorkspace: procedure()
    .input(
      z.object({
        chatUid: z.string(),
        workspace: z.array(
          z.object({
            type: z.literal('directory').or(z.literal('file')),
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

  // 更新 pendingMessages（前端保存草稿/待发送消息）
  updatePendingMessages: procedure()
    .input(
      z.object({
        chatUid: z.string(),
        pendingMessages: z
          .array(
            z.object({
              id: z.string(),
              content: z.string(),
              ready: z.boolean().optional(),
              createdAt: z.number(),
              updatedAt: z.number().optional(),
            }),
          )
          .nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const chat = await updatePendingMessages(input.chatUid, input.pendingMessages as any)
      update('chat.updated', chat)
      return chat
    }),
  // 删除会话（带通知）
  delete: procedure()
    .input(
      z.object({
        chatUid: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      logger.info(`Deleting chat: ${input.chatUid}`)
      await deleteChat(input.chatUid)
      update('chat.deleted', { uid: input.chatUid })
      return { success: true }
    }),
})
