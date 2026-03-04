import type { AutocompleteSuggestion, TriggerChar, TriggerMatch } from './types'

// ─── 触发检测 ─────────────────────────────────────────────────────────────────

/**
 * 匹配规则：触发字符前必须是行首或空白字符（防止误匹配 email 的 @）
 * 捕获组：(前缀空白)(触发字符)(query非空白)
 */
const TRIGGER_RE = /(^|\s)([@#/])(\S*)$/

/**
 * 从光标前的文本中检测激活的触发序列。
 *
 * @param textBeforeCursor 当前文本节点中光标之前的全部文本
 * @returns 匹配到的触发信息，或 null
 *
 * @example
 * detectTrigger('hello @sk')  // { trigger: '@', query: 'sk', triggerOffset: 6 }
 * detectTrigger('user@mail')  // null  (@ 前没有空白/行首)
 * detectTrigger('@')          // { trigger: '@', query: '', triggerOffset: 0 }
 */
export function detectTrigger(textBeforeCursor: string): TriggerMatch | null {
  const match = TRIGGER_RE.exec(textBeforeCursor)
  if (!match)
    return null

  const [, prefix, trigger, query] = match
  const triggerOffset = match.index + prefix.length

  return {
    trigger: trigger as TriggerChar,
    query,
    triggerOffset,
  }
}

// ─── 候选过滤 ─────────────────────────────────────────────────────────────────

/**
 * 过滤并排序候选项：
 *   1. 前缀匹配（label 以 query 开头）优先
 *   2. 包含匹配次之
 *   3. 结果截断到 maxCount
 *
 * @param suggestions 候选列表
 * @param query 用户输入的查询字符串（不含触发字符）
 * @param maxCount 最多返回条数，默认 8
 */
export function filterSuggestions(
  suggestions: AutocompleteSuggestion[],
  query: string,
  maxCount = 8,
): AutocompleteSuggestion[] {
  if (!query)
    return suggestions.slice(0, maxCount)

  const q = query.toLowerCase()
  const prefix: AutocompleteSuggestion[] = []
  const contains: AutocompleteSuggestion[] = []

  for (const s of suggestions) {
    const l = s.label.toLowerCase()
    if (l.startsWith(q))
      prefix.push(s)
    else if (l.includes(q))
      contains.push(s)
  }

  return [...prefix, ...contains].slice(0, maxCount)
}

// ─── 插入文本生成 ──────────────────────────────────────────────────────────────

/**
 * 决定实际插入到编辑器的文本。
 * 优先使用 `suggestion.insertText`；未定义时默认 `trigger + label + ' '`。
 */
export function formatInsertText(
  trigger: TriggerChar,
  suggestion: AutocompleteSuggestion,
): string {
  if (suggestion.insertText !== undefined)
    return suggestion.insertText
  return `${trigger}${suggestion.label} `
}

// ─── query 高亮切片 ───────────────────────────────────────────────────────────

export interface HighlightSegment {
  text: string
  highlight: boolean
}

/**
 * 将 label 拆分成普通 / 高亮两类片段，供渲染时加粗高亮 query 子字符串。
 *
 * @example
 * highlightLabel('file_system', 'file')
 * // [{ text: 'file', highlight: true }, { text: '_system', highlight: false }]
 */
export function highlightLabel(label: string, query: string): HighlightSegment[] {
  if (!query)
    return [{ text: label, highlight: false }]

  const q = query.toLowerCase()
  const idx = label.toLowerCase().indexOf(q)
  if (idx < 0)
    return [{ text: label, highlight: false }]

  const segments: HighlightSegment[] = []
  if (idx > 0)
    segments.push({ text: label.slice(0, idx), highlight: false })
  segments.push({ text: label.slice(idx, idx + q.length), highlight: true })
  if (idx + q.length < label.length)
    segments.push({ text: label.slice(idx + q.length), highlight: false })

  return segments
}
