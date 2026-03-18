import type { Message } from '@/node/database/schema/chat'
import { trpcClient } from '@/lib/trpc-client'

export interface ExportableMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  createdAt: number
}

export type MessageExportFormat = 'txt' | 'md' | 'json'

const PREVIEW_STORAGE_PREFIX = 'holix-preview-session:'

function escapeMarkdownText(text: string) {
  return text.replace(/([*_~`>])/g, '\\$1')
}

function roleLabel(role: ExportableMessage['role']) {
  return role === 'assistant' ? 'AI' : role === 'user' ? '用户' : role === 'system' ? '系统' : '工具'
}

export function getMessageDisplayContent(message?: Message | null) {
  if (!message)
    return ''

  if (message.content)
    return message.content

  if (!message.draftContent)
    return ''

  return message.draftContent
    .filter(segment => segment.phase === 'answer')
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(segment => segment.content)
    .join('')
}

export function toExportableMessage(message: Message): ExportableMessage {
  return {
    id: message.uid,
    role: message.role,
    createdAt: message.createdAt,
    content: getMessageDisplayContent(message) || message.error || '',
  }
}

export function buildExportText(messages: ExportableMessage[]) {
  return messages
    .map(msg => `【${roleLabel(msg.role)}】\n${msg.content}`)
    .join('\n\n---\n\n')
}

export function buildExportMarkdown(messages: ExportableMessage[]) {
  return messages
    .map((msg, index) => {
      const prefix = index > 0 ? '\n---\n\n' : ''
      return `${prefix}## ${roleLabel(msg.role)}\n\n${escapeMarkdownText(msg.content)}`
    })
    .join('')
}

export function buildExportJson(messages: ExportableMessage[]) {
  return JSON.stringify(messages, null, 2)
}

export function buildExportContent(messages: ExportableMessage[], format: MessageExportFormat) {
  if (format === 'json')
    return buildExportJson(messages)
  if (format === 'md')
    return buildExportMarkdown(messages)
  return buildExportText(messages)
}

export async function saveMessagesToFile({
  messages,
  format,
  suggestedName,
}: {
  messages: ExportableMessage[]
  format: MessageExportFormat
  suggestedName?: string
}) {
  const result = await trpcClient.dialog.saveFile({
    title: '导出消息',
    defaultFileName: suggestedName,
    filters: [
      {
        name: format === 'json' ? 'JSON 文件' : format === 'md' ? 'Markdown 文件' : '文本文件',
        extensions: [format],
      },
    ],
    content: buildExportContent(messages, format),
  })

  return result
}

export function createMessagePreviewSession(messages: ExportableMessage[]) {
  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  localStorage.setItem(`${PREVIEW_STORAGE_PREFIX}${sessionId}`, JSON.stringify({
    createdAt: Date.now(),
    messages,
  }))
  return sessionId
}

export function getMessagePreviewSession(sessionId: string) {
  const raw = localStorage.getItem(`${PREVIEW_STORAGE_PREFIX}${sessionId}`)
  if (!raw)
    return null

  try {
    const data = JSON.parse(raw) as {
      createdAt: number
      messages: ExportableMessage[]
    }

    return data.messages
  }
  catch {
    return null
  }
}

export function openMessagePreviewWindow(messages: ExportableMessage[]) {
  const sessionId = createMessagePreviewSession(messages)
  const url = `${window.location.origin}/preview?session=${encodeURIComponent(sessionId)}`
  return window.open(url, '_blank', 'popup=yes,width=1200,height=900,menubar=no,toolbar=no,location=no')
}
