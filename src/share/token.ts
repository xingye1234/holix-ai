/**
 * Token 估算工具
 * 提供简单的 token 数量估算功能
 */

/**
 * 估算文本的 token 数量
 * 使用简化的规则进行估算：
 * - 英文和数字：约 4 个字符 = 1 token
 * - 中文字符：约 1.5 个字符 = 1 token
 * - 特殊符号和空格：约 1 个字符 = 0.5 token
 *
 * @param text - 要估算的文本
 * @returns 估算的 token 数量
 */
export function estimateTokens(text: string): number {
  if (!text)
    return 0

  // 统计中文字符（包括中文标点）
  const chineseChars = text.match(/[\u4E00-\u9FA5\u3000-\u303F\uFF00-\uFFEF]/g) || []
  const chineseCount = chineseChars.length

  // 统计英文单词（按空格和标点分割）
  const englishWords = text.match(/[a-z0-9]+/gi) || []
  const englishWordCount = englishWords.reduce((sum, word) => sum + word.length, 0)

  // 统计其他字符（符号、空格等）
  const otherChars = text.length - chineseCount - englishWordCount

  // 计算估算的 token 数
  const chineseTokens = chineseCount / 1.5
  const englishTokens = englishWordCount / 4
  const otherTokens = otherChars / 2

  return Math.ceil(chineseTokens + englishTokens + otherTokens)
}

/**
 * 估算多条消息的总 token 数量
 * @param messages - 消息数组
 * @returns 估算的总 token 数量
 */
export function estimateMessagesTokens(messages: Array<{ content: string }>): number {
  return messages.reduce((total, msg) => total + estimateTokens(msg.content), 0)
}

/**
 * 格式化 token 数量显示
 * @param tokens - token 数量
 * @returns 格式化后的字符串
 */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) {
    return `${tokens}`
  }
  if (tokens < 1000000) {
    return `${(tokens / 1000).toFixed(1)}K`
  }
  return `${(tokens / 1000000).toFixed(1)}M`
}

/**
 * 检查文本是否超过指定的 token 限制
 * @param text - 要检查的文本
 * @param limit - token 限制
 * @returns 是否超过限制
 */
export function isTokenLimitExceeded(text: string, limit: number): boolean {
  return estimateTokens(text) > limit
}

/**
 * 截断文本以符合 token 限制
 * @param text - 原始文本
 * @param limit - token 限制
 * @returns 截断后的文本
 */
export function truncateToTokenLimit(text: string, limit: number): string {
  const estimatedTokens = estimateTokens(text)

  if (estimatedTokens <= limit) {
    return text
  }

  // 粗略估算需要保留的字符比例
  const ratio = limit / estimatedTokens
  const targetLength = Math.floor(text.length * ratio * 0.9) // 留 10% 余量

  return `${text.slice(0, targetLength)}...`
}
