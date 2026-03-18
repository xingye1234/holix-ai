/**
 * 内容提取器
 * 从 AIMessageChunk 中提取不同类型的内容
 */

import type { AIMessageChunk } from '@langchain/core/messages'

/**
 * 内容提取器类
 */
export class ContentExtractor {
  /**
   * 从 AIMessageChunk.content 中提取纯文本增量
   * 兼容两种格式：
   * - 纯字符串（OpenAI / Ollama）
   * - 多模态数组 `{ type:'text', text:string }[]`（Anthropic / Gemini）
   */
  extractTextDelta(content: AIMessageChunk['content']): string {
    if (typeof content === 'string') {
      return content
    }

    if (Array.isArray(content)) {
      return content
        .filter((c: any) => c?.type === 'text')
        .map((c: any) => c.text as string)
        .join('')
    }

    return ''
  }

  /**
   * 提取图片内容（为多媒体支持做准备）
   */
  extractImageContent(content: AIMessageChunk['content']): Array<{ url?: string, base64?: string }> {
    if (!Array.isArray(content)) {
      return []
    }

    return content
      .filter((c: any) => c?.type === 'image_url')
      .map((c: any) => ({
        url: c.image_url?.url,
        base64: c.image_url?.url?.startsWith('data:') ? c.image_url.url : undefined,
      }))
  }

  /**
   * 检查内容是否包含多媒体
   */
  hasMultimedia(content: AIMessageChunk['content']): boolean {
    if (!Array.isArray(content)) {
      return false
    }

    return content.some((c: any) =>
      c?.type === 'image_url'
      || c?.type === 'video'
      || c?.type === 'audio',
    )
  }

  /**
   * 提取所有内容类型
   */
  extractContentTypes(content: AIMessageChunk['content']): string[] {
    if (typeof content === 'string') {
      return ['text']
    }

    if (Array.isArray(content)) {
      return [...new Set(content.map((c: any) => c?.type).filter(Boolean))]
    }

    return []
  }
}

// 导出单例
export const contentExtractor = new ContentExtractor()
