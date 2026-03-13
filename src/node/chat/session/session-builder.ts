/**
 * 会话构建器
 * 负责构建 LangChain Agent 和相关配置
 */

import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { SystemMessage } from '@langchain/core/messages'
import type { Message, Workspace } from '../../database/schema/chat'
import type { ToolLoadingStrategy } from '../tools/tool-registry'
import { HumanMessage, SystemMessage as LangChainSystemMessage } from '@langchain/core/messages'
import { createAgent } from 'langchain'
import { configStore } from '../../platform/config'
import { logger } from '../../platform/logger'
import builtinMessages from '../builtin/messages'
import { contextSchema } from '../context'
import { skillManager } from '../skills'
import { createToolRegistry } from '../tools/tool-registry'

/**
 * 会话构建器配置
 */
export interface SessionBuilderConfig {
  /** LLM 模型 */
  llm: BaseChatModel

  /** 系统消息 */
  systemMessages?: string[]

  /** 工作区 */
  workspace?: Workspace[]

  /** 工具加载策略 */
  toolLoadingStrategy?: ToolLoadingStrategy

  /** 核心 Skills（仅在 smart 策略下使用） */
  coreSkills?: string[]
}

/**
 * 会话构建器
 */
export class SessionBuilder {
  private config: SessionBuilderConfig

  constructor(config: SessionBuilderConfig) {
    this.config = config
  }

  /**
   * 构建 LangChain Agent
   */
  buildAgent(chatUid: string, signal?: AbortSignal) {
    // 构建工具
    const toolRegistry = createToolRegistry({
      strategy: this.config.toolLoadingStrategy || 'eager',
      coreSkills: this.config.coreSkills,
    })
    const tools = toolRegistry.buildTools()

    // 构建 System Prompt
    const systemPrompt = this.buildSystemPrompt(toolRegistry)

    // 创建 Agent
    const agent = createAgent({
      model: this.config.llm,
      signal,
      systemPrompt,
      tools,
      contextSchema,
    })

    logger.info(
      `[SessionBuilder] Agent created | tools=${tools.length} strategy=${this.config.toolLoadingStrategy || 'eager'}`,
    )

    return agent
  }

  /**
   * 构建消息历史
   */
  buildMessages(contextMessages: Message[], userMessageContent: string) {
    const messages: (HumanMessage | LangChainSystemMessage)[] = []

    // 添加历史消息
    for (const msg of contextMessages) {
      if (msg.role === 'user') {
        messages.push(new HumanMessage(msg.content || ''))
      }
      else if (msg.role === 'assistant') {
        // Assistant 消息也作为 HumanMessage（LangChain 的约定）
        messages.push(new HumanMessage(msg.content || ''))
      }
      else if (msg.role === 'system') {
        messages.push(new LangChainSystemMessage(msg.content || ''))
      }
    }

    // 添加当前用户消息
    messages.push(new HumanMessage(userMessageContent))

    return messages
  }

  /**
   * 构建配置上下文
   */
  buildContext(chatUid: string) {
    return {
      config: configStore.getData(),
      chatUid,
    }
  }

  /**
   * 构建 System Prompt
   */
  private buildSystemPrompt(toolRegistry: any): LangChainSystemMessage {
    const content: Array<{ type: 'text', text: string }> = []

    // 1. 全局系统提示
    content.push({
      type: 'text',
      text: builtinMessages.globalSystem,
    })

    // 2. 用户自定义系统消息
    if (this.config.systemMessages) {
      for (const msg of this.config.systemMessages) {
        content.push({ type: 'text', text: msg })
      }
    }

    // 3. Skill System Prompts（根据策略）
    const skillPrompts = toolRegistry.getSkillSystemPrompts()
    for (const prompt of skillPrompts) {
      content.push({ type: 'text', text: prompt })
    }

    // 4. 工作区上下文
    const workspacePrompt = this.buildWorkspacePrompt()
    if (workspacePrompt) {
      content.push({ type: 'text', text: workspacePrompt })
    }

    return new LangChainSystemMessage({ content })
  }

  /**
   * 构建工作区提示词
   */
  private buildWorkspacePrompt(): string | null {
    if (!this.config.workspace || this.config.workspace.length === 0) {
      return null
    }

    const dirs = this.config.workspace
      .filter(w => w.type === 'directory')
      .map(w => `  - ${w.value}`)

    const files = this.config.workspace
      .filter(w => w.type === 'file')
      .map(w => `  - ${w.value}`)

    const lines: string[] = [
      '## Workspace',
      '',
      'The user has configured the following local paths for this conversation.',
      'You can use file system and code reading tools to read, search, or browse these paths:',
    ]

    if (dirs.length > 0) {
      lines.push('', '**Directories:**', ...dirs)
    }

    if (files.length > 0) {
      lines.push('', '**Files:**', ...files)
    }

    lines.push(
      '',
      'When the user asks about code, files, or project structure, look in these paths first.',
      'Always prefer reading the actual files rather than guessing their content.',
    )

    return lines.join('\n')
  }
}
