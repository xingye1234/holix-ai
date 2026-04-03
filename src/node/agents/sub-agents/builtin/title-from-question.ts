import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createLlm } from '@/node/chat/llm'
import type { BuiltinSubAgent, TitleFromQuestionInput, TitleFromQuestionResult } from '../types'

export function fallbackTitleFromQuestion(question: string): string {
  const trimmed = question.trim()
  if (!trimmed) {
    return '新对话'
  }

  const normalized = trimmed.replace(/\s+/g, ' ')
  const match = normalized.match(/^(.{1,30}[。？！?!])/)
  if (match) {
    return match[1].trim()
  }

  return normalized.length > 30 ? `${normalized.slice(0, 30)}...` : normalized
}

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part
        }
        if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
          return part.text
        }
        return ''
      })
      .join(' ')
      .trim()
  }

  return ''
}

function normalizeGeneratedTitle(rawTitle: string, fallbackQuestion: string): string {
  const cleaned = rawTitle
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/^标题[:：]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  return cleaned || fallbackTitleFromQuestion(fallbackQuestion)
}

async function generateTitleWithLlm(input: TitleFromQuestionInput): Promise<string> {
  if (!input.modelConfig?.apiKey) {
    throw new Error('missing-model-config')
  }

  const llm = createLlm(input.modelConfig.model, {
    provider: input.modelConfig.provider,
    apiType: input.modelConfig.provider,
    apiKey: input.modelConfig.apiKey,
    baseURL: input.modelConfig.baseURL,
    temperature: 0.2,
    maxTokens: 40,
    streaming: false,
  })

  const response = await llm.invoke([
    new SystemMessage(
      'You generate concise chat titles from a user question. Return only the title text with no quotes, no prefix, and no explanation.',
    ),
    new HumanMessage(`Question:\n${input.question}\n\nWrite one concise title.`),
  ])

  return normalizeGeneratedTitle(extractTextContent(response.content), input.question)
}

export const titleFromQuestionSubAgent: BuiltinSubAgent<'title-from-question'> = {
  id: 'title-from-question',
  description: 'Generate a concise chat title from the user question',
  async run(input): Promise<TitleFromQuestionResult> {
    try {
      const title = await generateTitleWithLlm(input)
      return {
        title,
        source: 'llm',
      }
    }
    catch {
      return {
        title: fallbackTitleFromQuestion(input.question),
        source: 'fallback',
      }
    }
  },
}

