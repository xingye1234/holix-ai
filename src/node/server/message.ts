import { z } from 'zod'
import {
  commitDraftContent,
  createMessage,
  deleteMessage,
  getLatestMessages,
  getMessageByUid,
  getMessagesByChatUid,
  getNextSeq,
  searchMessages,
  searchMessagesBM25,
  setMessageError,
  updateMessage,
  updateMessageContent,
  updateMessageDraftContent,
  updateMessageStatus,
} from '../database/message-operations'
import { procedure, router } from './trpc'

// 草稿片段 Schema
const draftSegmentSchema = z.object({
  id: z.string(),
  content: z.string(),
  phase: z.enum(['thinking', 'answer', 'tool', 'partial']),
  source: z.enum(['model', 'tool', 'system']),
  committed: z.boolean().optional(),
  delta: z.boolean().optional(),
  createdAt: z.number(),
})

// 定义消息相关的 procedures
export const messageRouter = router({
  // 创建消息
  create: procedure()
    .input(
      z.object({
        chatUid: z.string(),
        role: z.enum(['user', 'assistant', 'system', 'tool']),
        kind: z.string(),
        content: z.string().optional(),
        draftContent: z.array(draftSegmentSchema).optional(),
        status: z
          .enum(['pending', 'streaming', 'done', 'aborted', 'error'])
          .optional(),
        model: z.string().optional(),
        parentUid: z.string().optional(),
        requestId: z.string().optional(),
        streamId: z.string().optional(),
        toolName: z.string().optional(),
        toolPayload: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      // 获取下一个序号
      const seq = await getNextSeq(input.chatUid)

      const message = await createMessage({
        chatUid: input.chatUid,
        seq,
        role: input.role,
        kind: input.kind,
        content: input.content,
        draftContent: input.draftContent,
        status: input.status,
        model: input.model,
        parentUid: input.parentUid,
        requestId: input.requestId,
        streamId: input.streamId,
        toolName: input.toolName,
        toolPayload: input.toolPayload,
      })

      return message
    }),

  // 获取消息详情
  getById: procedure()
    .input(
      z.object({
        messageUid: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const message = await getMessageByUid(input.messageUid)
      if (!message) {
        throw new Error(`Message not found: ${input.messageUid}`)
      }
      return message
    }),

  // 获取会话的所有消息（从最新开始，支持向前加载）
  getByChatUid: procedure()
    .input(
      z.object({
        chatUid: z.string(),
        beforeSeq: z.number().optional(),
        limit: z.number().default(200),
        order: z.enum(['asc', 'desc']).default('desc'),
      }),
    )
    .query(async ({ input }) => {
      return await getMessagesByChatUid(input.chatUid, {
        beforeSeq: input.beforeSeq,
        limit: input.limit,
        order: input.order,
      })
    }),

  // 获取最新消息
  getLatest: procedure()
    .input(
      z.object({
        chatUid: z.string(),
        limit: z.number().default(20),
      }),
    )
    .query(async ({ input }) => {
      return await getLatestMessages(input.chatUid, input.limit)
    }),

  // 更新消息内容
  updateContent: procedure()
    .input(
      z.object({
        messageUid: z.string(),
        content: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      await updateMessageContent(input.messageUid, input.content)
      return { success: true }
    }),

  // 更新草稿内容
  updateDraftContent: procedure()
    .input(
      z.object({
        messageUid: z.string(),
        draftContent: z.array(draftSegmentSchema),
      }),
    )
    .mutation(async ({ input }) => {
      await updateMessageDraftContent(input.messageUid, input.draftContent)
      return { success: true }
    }),

  // 更新消息状态
  updateStatus: procedure()
    .input(
      z.object({
        messageUid: z.string(),
        status: z.enum(['pending', 'streaming', 'done', 'aborted', 'error']),
      }),
    )
    .mutation(async ({ input }) => {
      await updateMessageStatus(input.messageUid, input.status)
      return { success: true }
    }),

  // 设置错误
  setError: procedure()
    .input(
      z.object({
        messageUid: z.string(),
        error: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      await setMessageError(input.messageUid, input.error)
      return { success: true }
    }),

  // 提交草稿内容
  commitDraft: procedure()
    .input(
      z.object({
        messageUid: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      await commitDraftContent(input.messageUid)
      return { success: true }
    }),

  // 删除消息
  delete: procedure()
    .input(
      z.object({
        messageUid: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      await deleteMessage(input.messageUid)
      return { success: true }
    }),

  // 搜索消息
  search: procedure()
    .input(
      z.object({
        keyword: z.string(),
        chatUid: z.string().optional(),
        limit: z.number().optional(),
      }),
    )
    .query(async ({ input }) => {
      return await searchMessages(input.keyword, {
        chatUid: input.chatUid,
        limit: input.limit,
      })
    }),

  searchBm25: procedure()
    .input(
      z.object({
        keyword: z.string(),
        chatUid: z.string().optional(),
        limit: z.number().optional().default(10),
      }),
    )
    .query(async ({ input }) => {
      return await searchMessagesBM25(input.keyword, {
        chatUid: input.chatUid,
        limit: input.limit,
      })
    }),

  // 批量更新
  update: procedure()
    .input(
      z.object({
        messageUid: z.string(),
        updates: z.object({
          content: z.string().optional(),
          status: z
            .enum(['pending', 'streaming', 'done', 'aborted', 'error'])
            .optional(),
          model: z.string().optional(),
          searchable: z.boolean().optional(),
          error: z.string().optional(),
        }),
      }),
    )
    .mutation(async ({ input }) => {
      await updateMessage(input.messageUid, input.updates)
      return { success: true }
    }),
})
