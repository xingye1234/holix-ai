import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import * as t from 'drizzle-orm/sqlite-core'
import { index, sqliteTableCreator, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const sqliteTable = sqliteTableCreator(name => name)

export interface DraftSegment {
  /** 流内唯一 ID（顺序可恢复） */
  id: string

  /** 本段内容（增量 or 完整） */
  content: string

  /** 阶段 */
  phase: 'thinking' | 'answer' | 'tool' | 'partial' | 'agent'

  /** 来源 */
  source: 'model' | 'tool' | 'system'

  // 是否合并
  committed?: boolean

  /** 是否为增量 chunk */
  delta?: boolean

  /** 时间戳 */
  createdAt: number

  // ─── 工具调用专属字段（phase === 'tool' 时填充）────────────────────────

  /** LangChain tool_call_id，用于关联 model 调用请求与 tool 执行结果 */
  toolCallId?: string

  /** 工具名称（预解析，方便 UI 直接展示） */
  toolName?: string

  /** 工具调用参数（预解析） */
  toolArgs?: Record<string, unknown>

  /**
   * 审批状态，仅限 source==='model' 且工具为高风险时设置。
   * - 'pending'  : 等待用户审批
   * - 'approved' : 用户已批准，正在执行
   * - 'denied'   : 用户拒绝，工具调用被阻断
   */
  approvalStatus?: 'pending' | 'approved' | 'denied'

  // ─── Agent 执行专属字段（phase === 'agent' 时填充）───────────────────────

  /** Lifecycle / sub-agent 稳定 ID */
  agentId?: string

  /** 便于 UI 展示的 agent 名称 */
  agentName?: string

  /** 触发 agent 执行的 hook */
  agentHook?: 'onChatCreated' | 'onMessageCompleted' | 'onChatIdle' | 'onMessageError'

  /** agent 执行状态 */
  agentStatus?: 'success' | 'error' | 'suggest'

  /** 建议类型（若 agent 返回 suggestion） */
  agentSuggestionType?: 'title' | 'summary' | 'tool' | 'agent' | 'action'

  /** 建议内容（若 agent 返回 suggestion） */
  agentSuggestionContent?: string
}

export interface PendingMessage {
  /** 本地唯一 ID */
  id: string

  /** 用户输入内容（支持 Markdown / Code） */
  content: string

  /** 是否被选中准备发送 */
  ready?: boolean

  /** 创建时间 */
  createdAt: number

  /** 最近编辑时间 */
  updatedAt?: number
}

export type DraftContent = DraftSegment[]

export interface ToolCallTrace {
  id: string
  toolCallId?: string
  toolName: string
  toolArgs?: Record<string, unknown>
  requestContent: string
  resultContent?: string
  status: 'called' | 'completed'
  createdAt: number
  updatedAt: number
}

export interface MessageTextTelemetry {
  charCount: number
  estimatedTokens: number
}

export interface MessageExecutionTelemetry {
  llmRuns: number
  chainRuns: number
  toolCalls: number
  toolNames: string[]
  startedAt?: number
  firstTokenAt?: number
  completedAt?: number
}

export interface MessageTelemetry {
  version: 1
  provider?: string
  model?: string
  input?: MessageTextTelemetry
  output?: MessageTextTelemetry
  usage?: {
    totalEstimatedTokens: number
  }
  execution?: MessageExecutionTelemetry
}

export interface Workspace {
  type: 'directory' | 'file'
  value: string
}

type Workspaces = Workspace[]

export interface ChatContextSettings {
  /** 参与上下文的最近消息数量 */
  maxMessages: number
  /** 参与上下文的时间窗口（小时），null 表示不限时间 */
  timeWindowHours: number | null
  /** 发送新消息后是否自动滚动到底部 */
  autoScrollToBottomOnSend: boolean
}

export const DEFAULT_CHAT_CONTEXT_SETTINGS: ChatContextSettings = {
  maxMessages: 10,
  timeWindowHours: 24,
  autoScrollToBottomOnSend: true,
}

export const chats = sqliteTable(
  'chat',
  {
    /** 数据库主键 */
    id: t.int().primaryKey({ autoIncrement: true }),

    /** 稳定对外 ID */
    uid: t.text('uid').notNull().unique(),

    /** 会话标题 */
    title: t.text('title').notNull(),

    /** 最近一条消息预览（仅 UI 缓存） */
    lastMessagePreview: t.text('last_message_preview'),

    /** 模型提供方 */
    provider: t.text('provider').notNull(), // openai / azure / local / custom

    /** 模型名称 */
    model: t.text('model').notNull(),

    /** 会话生命周期状态 */
    status: t
      .text('status', {
        enum: ['active', 'archived', 'error'],
      })
      .notNull()
      .default('active'),

    /** 是否置顶 */
    pinned: t.integer('pinned', { mode: 'boolean' }).notNull().default(false),

    /** 是否归档 */
    archived: t
      .integer('archived', { mode: 'boolean' })
      .notNull()
      .default(false),

    /** 创建时间（毫秒） */
    createdAt: t.integer('created_at').notNull().default(sql`(strftime('%s','now') * 1000)`),

    /** 最近更新时间（左侧列表排序核心） */
    updatedAt: t.integer('updated_at').notNull().default(sql`(strftime('%s','now') * 1000)`),

    /** 过期时间（毫秒时间戳，null 表示永不过期） */
    expiresAt: t.integer('expires_at'),

    /** 当前会话最后一条消息序号（增量同步用） */
    lastSeq: t.integer('last_seq').notNull().default(0),
    /** 待发送消息列表（本地缓存） */
    pendingMessages: t.text('pending_messages').$type<PendingMessage[]>(),
    // 会话预设 / 系统提示
    prompts: t.text('prompts').$type<string[]>().notNull().default([]),

    /** 工作区 */
    workspace: t.text('workspace').$type<Workspaces>(),

    /** 聊天上下文策略 */
    contextSettings: t
      .text('context_settings', { mode: 'json' })
      .$type<ChatContextSettings>()
      .notNull()
      .default(DEFAULT_CHAT_CONTEXT_SETTINGS),
  },
  table => ({
    chatUidIdx: index('idx_chat_uid').on(table.uid),
    chatUpdateIdx: index('idx_chat_updated').on(table.updatedAt),
  }),
)

export const message = sqliteTable(
  'message',
  {
    /** 数据库主键 */
    id: t.integer('id').primaryKey({ autoIncrement: true }),

    /** 稳定消息 ID（streaming / IPC / 前端追踪） */
    uid: t.text('uid').notNull().unique(),

    /** 会话内顺序号（严格递增） */
    seq: t.integer('seq').notNull(),

    /** 所属会话 */
    chatUid: t
      .text('chat_uid')
      .notNull()
      .references(() => chats.uid, { onDelete: 'cascade' }),

    /** 模型视角角色 */
    role: t
      .text('role', {
        enum: ['user', 'assistant', 'system', 'tool'],
      })
      .notNull(),

    /** 系统 / 产品语义类型 */
    kind: t.text('kind').notNull(),
    // message | tool_call | tool_result | thinking | partial

    /** 最终消息内容（done 时必有） */
    content: t.text('content'),

    /** streaming / 草稿内容 */
    draftContent: t.text('draft_content').$type<DraftContent>(),

    /** 工具调用轨迹（用于持久化展示每一次 tool 调用） */
    toolCalls: t.text('tool_calls').$type<ToolCallTrace[]>(),

    /** 消息状态 */
    status: t
      .text('status', {
        enum: ['pending', 'streaming', 'done', 'aborted', 'error'],
      })
      .notNull()
      .default('done'),

    /** 工具调用状态 */
    toolStatus: t.text('tool_status').$type<{
      /** 是否正在执行工具 */
      running: boolean
      /** 当前执行的工具名称列表 */
      tools: string[]
    }>(),

    /** assistant 消息使用的模型 */
    model: t.text('model'),

    /** 是否参与搜索 */
    searchable: t
      .integer('searchable', { mode: 'boolean' })
      .notNull()
      .default(true),

    /** 搜索索引版本（未来重建索引用） */
    searchIndexVersion: t.integer('search_index_version'),

    /** 上下文链（回复 / tool 结果等） */
    parentUid: t.text('parent_uid'),

    /** 一次 AI 请求的唯一标识 */
    requestId: t.text('request_id'),

    /** assistant 消息对应的 streaming 请求 */
    streamId: t.text('stream_id'),

    /** tool / MCP 信息 */
    toolName: t.text('tool_name'),
    toolPayload: t.text('tool_payload', { mode: 'json' }),
    telemetry: t.text('telemetry', { mode: 'json' }).$type<MessageTelemetry>(),

    /** 错误信息 */
    error: t.text('error'),

    /** 创建时间 */
    createdAt: t
      .integer('created_at')
      .notNull()
      .default(sql`(strftime('%s','now') * 1000)`),

    /** 更新时间 */
    updatedAt: t
      .integer('updated_at')
      .notNull()
      .default(sql`(strftime('%s','now') * 1000)`),
  },
  table => ({
    chatIdx: index('idx_messages_chat').on(table.chatUid),
    chatSeqIdx: index('idx_messages_chat_seq').on(table.chatUid, table.seq),
    timeIdx: index('idx_messages_time').on(table.createdAt),
    uidUnique: uniqueIndex('message_uid_unique').on(table.uid),
  }),
)

export const skillInvocationLog = sqliteTable(
  'skill_invocation_log',
  {
    id: t.integer('id').primaryKey({ autoIncrement: true }),
    skillName: t.text('skill_name').notNull(),
    toolName: t.text('tool_name').notNull(),
    args: t.text('args', { mode: 'json' }),
    result: t.text('result'),
    rejected: t.integer('rejected', { mode: 'boolean' }).notNull().default(false),
    error: t.text('error'),
    createdAt: t.integer('created_at').notNull().default(sql`(strftime('%s','now') * 1000)`),
  },
  table => ({
    skillToolIdx: index('idx_skill_invocation_skill_tool').on(table.skillName, table.toolName),
    createdAtIdx: index('idx_skill_invocation_created').on(table.createdAt),
  }),
)

export type Chat = InferSelectModel<typeof chats>
export type Message = InferSelectModel<typeof message>
export type SkillInvocationLog = InferSelectModel<typeof skillInvocationLog>
export type ChatInsert = InferInsertModel<typeof chats>
export type MessageInsert = InferInsertModel<typeof message>
export type SkillInvocationLogInsert = InferInsertModel<typeof skillInvocationLog>
