/**
 * 会话构建器
 * 负责构建 LangChain Agent 和相关配置
 */

import type { StructuredToolInterface } from '@langchain/core/tools'
import type { LoadedSkill } from '../skills/type'
import type { Message, Workspace } from '../../database/schema/chat'
import type { ToolLoadingStrategy } from '../tools/tool-registry'
import type { SessionModelConfig } from './session-state'
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import {
  AIMessage,
  HumanMessage,
  SystemMessage as LangChainSystemMessage,
} from '@langchain/core/messages'
import { initChatModel } from 'langchain/chat_models/universal'
import { createDeepAgent, FilesystemBackend } from 'deepagents'
import { APP_DATA_PATH } from '../../constant'
import { configStore } from '../../platform/config'
import { getChatSkillSettings } from '../../database/chat-skill-settings'
import { logger } from '../../platform/logger'
import { skillManager } from '../skills'
import { loadMcpTools } from '../mcp/tools'
import { chatKeywordSearchTool, chatTimeSearchTool } from '../tools/chat'
import { context7Tool } from '../tools/context7'
import { systemEnvTool, systemPlatformTool, systemTimeTool, systemTimezoneTool } from '../tools/system'

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

type DeepAgentParams = NonNullable<Parameters<typeof createDeepAgent>[0]>
type DeepAgentModel = Exclude<DeepAgentParams['model'], string | undefined>
type DeepAgentTools = NonNullable<DeepAgentParams['tools']>

/**
 * 会话构建器
 */
export class SessionBuilder {
  private config: SessionBuilderConfig
  private readonly deepAgentBuiltinTools = new Set([
    'ls',
    'read_file',
    'write_file',
    'edit_file',
    'glob',
    'grep',
    'execute',
  ])

  private readonly deepAgentBuiltInSkillNames = new Set([
    'file_system',
    'code_reader',
  ])

  constructor(config: SessionBuilderConfig) {
    this.config = config
  }

  /**
   * 构建 LangChain Deep Agent
   */
  async buildAgent(chatUid: string): Promise<ReturnType<typeof createDeepAgent>> {
    const enabledSkills = this.getEnabledSkills(chatUid)
    const runtimeSkillBundle = this.materializeRuntimeSkills(chatUid, enabledSkills)
    const tools = await this.buildTools(enabledSkills)
    const systemPrompt = this.buildSystemPrompt()
    const model = await this.buildModel()
    const backendRoot = this.resolveBackendRoot()

    const agent = createDeepAgent({
      // Deep Agents currently resolves its own LangChain type graph, so we
      // bridge the nominal type mismatch here instead of duplicating runtime logic.
      model: this.asDeepAgentModel(model),
      backend: new FilesystemBackend({ rootDir: backendRoot }),
      tools: this.asDeepAgentTools(tools),
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

  /**
   * 构建 System Prompt
   */
  private buildSystemPrompt(): string {
    const parts: string[] = []

    // 1. 用户自定义系统消息
    if (this.config.systemMessages) {
      for (const msg of this.config.systemMessages) {
        parts.push(msg)
      }
    }

    // 2. 工作区上下文
    const workspacePrompt = this.buildWorkspacePrompt()
    if (workspacePrompt) {
      parts.push(workspacePrompt)
    }

    // 合并为单个字符串
    return parts.join('\n\n')
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
      'You can use the filesystem tools (`ls`, `glob`, `grep`, `read_file`, `write_file`, `edit_file`) to inspect or modify these paths when needed:',
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

  private async buildModel() {
    const { provider, model, apiKey, baseURL } = this.config.modelConfig
    const modelProvider = this.normalizeModelProvider(provider)
    const modelIdentifier = `${modelProvider}:${model}`

    if (modelProvider === 'anthropic') {
      return await initChatModel(modelIdentifier, {
        apiKey,
        anthropicApiUrl: baseURL,
        streaming: true,
      })
    }

    if (modelProvider === 'google-genai') {
      return await initChatModel(modelIdentifier, {
        apiKey,
        baseUrl: baseURL,
        streaming: true,
      })
    }

    if (modelProvider === 'ollama') {
      return await initChatModel(modelIdentifier, {
        baseUrl: baseURL,
        streaming: true,
      })
    }

    return await initChatModel(modelIdentifier, {
      apiKey,
      configuration: baseURL ? { baseURL } : undefined,
      streaming: true,
    })
  }

  private normalizeModelProvider(provider: string) {
    const normalizedProvider = provider.toLowerCase()

    if (normalizedProvider === 'gemini' || normalizedProvider === 'google-genai') {
      return 'google-genai'
    }

    if (normalizedProvider === 'anthropic' || normalizedProvider === 'ollama') {
      return normalizedProvider
    }

    // OpenAI-compatible providers continue to share the OpenAI adapter path.
    return 'openai'
  }

  private asDeepAgentModel(model: Awaited<ReturnType<typeof this.buildModel>>): DeepAgentModel {
    return model as unknown as DeepAgentModel
  }

  private asDeepAgentTools(tools: StructuredToolInterface[]): DeepAgentTools {
    return tools as unknown as DeepAgentTools
  }

  private getEnabledSkills(chatUid: string): LoadedSkill[] {
    const chatSkillSettings = getChatSkillSettings(chatUid)
    const disabledSkills = new Set(configStore.get('disabledSkills') || [])

    for (const skillName of chatSkillSettings.enabledSkills) {
      disabledSkills.delete(skillName)
    }
    for (const skillName of chatSkillSettings.disabledSkills) {
      disabledSkills.add(skillName)
    }

    return skillManager
      .listSkills()
      .filter(skill => !disabledSkills.has(skill.name))
  }

  private async buildTools(enabledSkills: LoadedSkill[]) {
    const baseTools: StructuredToolInterface[] = [
      systemPlatformTool,
      systemEnvTool,
      systemTimezoneTool,
      systemTimeTool,
      chatTimeSearchTool,
      chatKeywordSearchTool,
    ]

    if (configStore.get('context7ApiKey')) {
      baseTools.push(context7Tool)
    }

    const customSkillTools = enabledSkills
      .filter(skill => !this.deepAgentBuiltInSkillNames.has(skill.name))
      .flatMap(skill => skill.tools)
      .filter(tool => !this.deepAgentBuiltinTools.has(tool.name))

    const mcpTools = await loadMcpTools()

    return this.dedupeToolsByName([
      ...baseTools,
      ...customSkillTools,
      ...mcpTools,
    ])
  }

  private dedupeToolsByName(tools: StructuredToolInterface[]) {
    const unique = new Map<string, StructuredToolInterface>()
    for (const tool of tools) {
      if (!unique.has(tool.name)) {
        unique.set(tool.name, tool)
      }
    }
    return Array.from(unique.values())
  }

  private materializeRuntimeSkills(chatUid: string, enabledSkills: LoadedSkill[]) {
    if (enabledSkills.length === 0) {
      return {
        skillSources: undefined as string[] | undefined,
        memorySources: undefined as string[] | undefined,
      }
    }

    const sessionRoot = join(APP_DATA_PATH, 'deepagents', 'sessions', this.safePathSegment(chatUid))
    const skillsRoot = join(sessionRoot, 'skills')
    rmSync(skillsRoot, { recursive: true, force: true })
    mkdirSync(skillsRoot, { recursive: true })

    for (const skill of enabledSkills) {
      const targetDir = join(skillsRoot, skill.name)
      cpSync(skill.dir, targetDir, { recursive: true, force: true })

      const targetSkillPath = join(targetDir, 'SKILL.md')
      if (!existsSync(targetSkillPath)) {
        writeFileSync(targetSkillPath, this.buildSkillMarkdown(skill), 'utf-8')
      }
    }

    const memorySources = this.materializeStrategyMemory(sessionRoot, enabledSkills)

    return {
      skillSources: [skillsRoot],
      memorySources,
    }
  }

  private materializeStrategyMemory(sessionRoot: string, enabledSkills: LoadedSkill[]) {
    const strategy = this.config.toolLoadingStrategy || 'eager'
    let alwaysLoadedSkills: LoadedSkill[] = []

    if (strategy === 'eager') {
      alwaysLoadedSkills = enabledSkills
    }
    else if (strategy === 'smart') {
      const coreSkills = new Set(this.config.coreSkills || [])
      alwaysLoadedSkills = enabledSkills.filter(skill => coreSkills.has(skill.name))
    }

    if (alwaysLoadedSkills.length === 0) {
      return undefined
    }

    mkdirSync(sessionRoot, { recursive: true })
    const memoryPath = join(sessionRoot, 'AGENTS.md')
    const body = [
      '# Holix Active Skills',
      '',
      'The following skill instructions are always relevant in this conversation.',
      '',
      ...alwaysLoadedSkills.flatMap((skill) => {
        const promptBody = this.buildSkillBody(skill)
        return [
          `## ${skill.name}`,
          '',
          skill.description,
          '',
          promptBody,
          '',
        ]
      }),
    ].join('\n')

    writeFileSync(memoryPath, `${body.trimEnd()}\n`, 'utf-8')
    return [memoryPath]
  }

  private buildSkillMarkdown(skill: LoadedSkill) {
    const allowedTools = this.getAllowedToolsForSkill(skill)
    const lines = [
      '---',
      `name: ${skill.name}`,
      `description: ${JSON.stringify(skill.description)}`,
    ]

    if (allowedTools.length > 0) {
      lines.push('allowed-tools:')
      for (const toolName of allowedTools) {
        lines.push(`  - ${toolName}`)
      }
    }

    lines.push('---', '', this.buildSkillBody(skill))

    return `${lines.join('\n').trimEnd()}\n`
  }

  private buildSkillBody(skill: LoadedSkill) {
    if (skill.name === 'file_system') {
      return [
        '# Filesystem',
        '',
        'Use the built-in filesystem tools to inspect and update local files when the task requires it.',
        '',
        '- Use `ls` to inspect directories',
        '- Use `glob` to find files by pattern',
        '- Use `grep` to search within files',
        '- Use `read_file` to inspect file contents with pagination',
        '- Use `write_file` to create or overwrite files',
        '- Use `edit_file` for targeted replacements',
        '',
        'Prefer absolute paths when possible, and start from the configured workspace paths first.',
      ].join('\n')
    }

    if (skill.name === 'code_reader') {
      return [
        '# Code Reading',
        '',
        'Use the built-in filesystem tools for code navigation and inspection.',
        '',
        '- Use `glob` to find candidate files',
        '- Use `grep` to search for symbols or text',
        '- Use `read_file` with `offset` and `limit` to read focused code ranges',
        '',
        'Avoid reading large files all at once. Narrow down with `glob`/`grep` first, then read only the relevant sections.',
      ].join('\n')
    }

    if (skill.prompt?.trim()) {
      return skill.prompt.trim()
    }

    return [
      `# ${skill.name}`,
      '',
      skill.description,
    ].join('\n')
  }

  private getAllowedToolsForSkill(skill: LoadedSkill) {
    if (skill.name === 'file_system') {
      return ['ls', 'read_file', 'write_file', 'edit_file', 'glob', 'grep']
    }

    if (skill.name === 'code_reader') {
      return ['glob', 'grep', 'read_file']
    }

    return skill.tools
      .map(tool => tool.name)
      .filter(toolName => !this.deepAgentBuiltinTools.has(toolName))
  }

  private resolveBackendRoot() {
    const workspace = this.config.workspace || []
    const candidates = workspace
      .map((entry) => {
        if (entry.type === 'directory') {
          return resolve(entry.value)
        }
        if (entry.type === 'file') {
          return resolve(dirname(entry.value))
        }
        return null
      })
      .filter((value): value is string => Boolean(value))

    if (candidates.length === 0) {
      return process.cwd()
    }

    return this.findCommonPath(candidates)
  }

  private findCommonPath(paths: string[]) {
    const resolvedPaths = paths.map(path => resolve(path))
    const splitPaths = resolvedPaths.map(path => path.split(/[\\/]+/).filter(Boolean))

    if (splitPaths.length === 0) {
      return process.cwd()
    }

    const first = splitPaths[0]
    const common: string[] = []

    for (let index = 0; index < first.length; index++) {
      const segment = first[index]
      if (splitPaths.every(path => path[index] === segment)) {
        common.push(segment)
      }
      else {
        break
      }
    }

    const root = resolvedPaths[0].startsWith('/') ? '/' : ''
    return common.length > 0 ? `${root}${common.join('/')}` : dirname(resolvedPaths[0])
  }

  private safePathSegment(value: string) {
    return value.replace(/[^\w.-]+/g, '_')
  }
}
