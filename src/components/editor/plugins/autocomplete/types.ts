export type TriggerChar = '@' | '#' | '/'

export interface AutocompleteSuggestion {
  id: string
  /** 显示名称，同时作为插入文本的基础 */
  label: string
  /** 副标题 / 描述 */
  description?: string
  /** emoji 或单字母图标 */
  icon?: string
  /** 业务类型标记：skill | file | command | ... */
  type?: string
  /**
   * 实际插入到编辑器的文本。
   * 不填时默认使用 `trigger + label + ' '`
   */
  insertText?: string
}

export interface AutocompleteSource {
  trigger: TriggerChar
  /** 弹窗 section 标题，不填则不显示 */
  title?: string
  /**
   * 候选列表：静态数组 或 根据 query 动态生成
   * （动态函数为同步，避免异步导致的竞态）
   */
  suggestions: AutocompleteSuggestion[] | ((query: string) => AutocompleteSuggestion[])
}

export interface AutocompleteEditorProps {
  sources: AutocompleteSource[]
  /** 插入成功后的回调 */
  onInsert?: (trigger: TriggerChar, item: AutocompleteSuggestion) => void
}

// ─── 内部状态类型 ─────────────────────────────────────────────────────────────

export interface TriggerMatch {
  trigger: TriggerChar
  query: string
  /** 当前文本节点中 trigger 字符的偏移量 */
  triggerOffset: number
}

export interface PopupPosition {
  x: number
  y: number
  /** 弹窗是否显示在光标上方（视口空间不足时） */
  above: boolean
}
