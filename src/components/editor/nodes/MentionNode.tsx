/**
 * MentionNode — 自动补全插入的 token 节点
 *
 * 渲染为内联 chip 样式，不同触发符（@ # /）使用不同颜色。
 * getTextContent() 返回不含触发前缀的纯值，用于消息发送时剥离 @、# 等指令前缀。
 */
import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical'
import { DecoratorNode } from 'lexical'
import * as React from 'react'

// ─── 序列化 ───────────────────────────────────────────────────────────────────

export type SerializedMentionNode = Spread<
  {
    trigger: string
    value: string
    displayText: string
  },
  SerializedLexicalNode
>

// ─── Chip 组件 ────────────────────────────────────────────────────────────────

const TRIGGER_COLOR: Record<string, string> = {
  '@': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  '#': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  '/': 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200 dark:border-violet-800',
}

function MentionChip({
  trigger,
  displayText,
}: {
  trigger: string
  displayText: string
}): React.JSX.Element {
  const colorClass = TRIGGER_COLOR[trigger] ?? 'bg-muted text-muted-foreground border-border'

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-xs font-medium leading-none mx-0.5 select-none ${colorClass}`}
      contentEditable={false}
      data-mention-trigger={trigger}
      data-mention-value={displayText}
    >
      <span className="opacity-50 font-normal">{trigger}</span>
      <span>{displayText}</span>
    </span>
  )
}

// ─── MentionNode ──────────────────────────────────────────────────────────────

export class MentionNode extends DecoratorNode<React.JSX.Element> {
  __trigger: string
  __value: string
  __displayText: string

  static getType(): string {
    return 'mention'
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(node.__trigger, node.__value, node.__displayText, node.__key)
  }

  constructor(trigger: string, value: string, displayText: string, key?: NodeKey) {
    super(key)
    this.__trigger = trigger
    this.__value = value
    this.__displayText = displayText
  }

  // ─── DOM ──────────────────────────────────────────────────────────────────

  createDOM(_config: EditorConfig): HTMLElement {
    return document.createElement('span')
  }

  updateDOM(): boolean {
    // React 负责更新，不需要 Lexical 直接操作 DOM
    return false
  }

  exportDOM(): DOMExportOutput {
    const el = document.createElement('span')
    el.textContent = this.__value
    el.setAttribute('data-lexical-mention-trigger', this.__trigger)
    el.setAttribute('data-lexical-mention-value', this.__value)
    el.setAttribute('data-lexical-mention-display', this.__displayText)
    return { element: el }
  }

  static importDOM(): DOMConversionMap {
    return {
      span: (node: Node) => {
        const el = node as HTMLElement
        if (!el.hasAttribute('data-lexical-mention-trigger'))
          return null
        return {
          conversion: (domNode: Node): DOMConversionOutput => {
            const span = domNode as HTMLElement
            const trigger = span.getAttribute('data-lexical-mention-trigger') ?? '@'
            const value = span.getAttribute('data-lexical-mention-value') ?? span.textContent ?? ''
            const displayText = span.getAttribute('data-lexical-mention-display') ?? value
            return { node: $createMentionNode(trigger, value, displayText) }
          },
          priority: 1,
        }
      },
    }
  }

  // ─── JSON 序列化 ───────────────────────────────────────────────────────────

  static importJSON(serialized: SerializedMentionNode): MentionNode {
    return $createMentionNode(serialized.trigger, serialized.value, serialized.displayText)
  }

  exportJSON(): SerializedMentionNode {
    return {
      type: 'mention',
      version: 1,
      trigger: this.__trigger,
      value: this.__value,
      displayText: this.__displayText,
    }
  }

  // ─── 行为 ──────────────────────────────────────────────────────────────────

  /** 以内联形式嵌入段落 */
  isInline(): boolean {
    return true
  }

  /**
   * 输出文本时去掉触发前缀，只保留值本身。
   * 例如 #README.md → "README.md"（剥离触发前缀，尾部空格由紧跟的 TextNode 提供）
   */
  getTextContent(): string {
    return this.__value
  }

  decorate(): React.JSX.Element {
    return <MentionChip trigger={this.__trigger} displayText={this.__displayText} />
  }
}

// ─── 工厂函数 ──────────────────────────────────────────────────────────────────

export function $createMentionNode(
  trigger: string,
  value: string,
  displayText: string,
): MentionNode {
  return new MentionNode(trigger, value, displayText)
}

export function $isMentionNode(
  node: LexicalNode | null | undefined,
): node is MentionNode {
  return node instanceof MentionNode
}
