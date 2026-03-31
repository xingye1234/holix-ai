/**
 * 会话构建器
 * 负责构建 LangChain Agent 和相关配置
 */

import type { Message, Workspace } from '../../database/schema/chat'
import type { ToolLoadingStrategy } from '../tools/tool-registry'
import type { SessionModelConfig } from './session-state'
import {
  AIMessage,
  HumanMessage,
  SystemMessage as LangChainSystemMessage,
} from '@langchain/core/messages'
import { createDeepAgent } from 'deepagents'
import { deepAgentLongTermMemoryStore } from '../../database/deepagents-store'
import { configStore } from '../../platform/config'
import { logger } from '../../platform/logger'
import { asDeepAgentStore, createSessionBackend } from './session-builder-backend'
import { asDeepAgentModel, buildSessionModel } from './session-builder-model'
import { buildSessionSystemPrompt } from './session-builder-prompt'
import { materializeRuntimeSkills, resolveBackendRoot } from './session-builder-skills'
import { asDeepAgentTools, buildSessionTools, getEnabledSkills } from './session-builder-tools'

/**
 * 会话构建器配置
 */
export interface SessionBuilderConfig {
  /** 模型配置 */
  modelConfig: SessionModelConfig

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
   * 构建 LangChain Deep Agent
   */
  async buildAgent(chatUid: string): Promise<ReturnType<typeof createDeepAgent>> {
    const enabledSkills = getEnabledSkills(chatUid)
    const runtimeSkillBundle = materializeRuntimeSkills({
      chatUid,
      enabledSkills,
      toolLoadingStrategy: this.config.toolLoadingStrategy,
      coreSkills: this.config.coreSkills,
    })
    const tools = await buildSessionTools(enabledSkills)
    const systemPrompt = buildSessionSystemPrompt({
      systemMessages: this.config.systemMessages,
      workspace: this.config.workspace,
    })
    const model = await buildSessionModel(this.config.modelConfig)
    const backendRoot = resolveBackendRoot(this.config.workspace)

    const agent = createDeepAgent({
      // Deep Agents currently resolves its own LangChain type graph, so we
      // bridge the nominal type mismatch here instead of duplicating runtime logic.
      model: asDeepAgentModel(model),
      store: asDeepAgentStore(deepAgentLongTermMemoryStore),
      backend: createSessionBackend(backendRoot),
      tools: asDeepAgentTools(tools),
      systemPrompt,
      skills: runtimeSkillBundle.skillSources,
      memory: runtimeSkillBundle.memorySources,
    })

    logger.info(
      `[SessionBuilder] DeepAgent created | provider=${this.config.modelConfig.provider} model=${this.config.modelConfig.model} tools=${tools.length} skills=${enabledSkills.length} strategy=${this.config.toolLoadingStrategy || 'eager'} backendRoot=${backendRoot}`,
    )

    return agent
  }

  /**
   * 构建消息历史
   */
  buildMessages(contextMessages: Message[], userMessageContent: string) {
    const messages: (HumanMessage | AIMessage | LangChainSystemMessage)[] = []

    // 添加历史消息
    for (const msg of contextMessages) {
      if (msg.role === 'user') {
        messages.push(new HumanMessage(msg.content || ''))
      }
      else if (msg.role === 'assistant') {
        // Assistant 消息应该转换为 AIMessage
        messages.push(new AIMessage(msg.content || ''))
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
}
