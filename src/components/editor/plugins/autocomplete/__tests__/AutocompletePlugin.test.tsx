/**
 * @fileoverview AutocompletePlugin 集成测试
 *
 * 测试真实的输入场景：
 * - 触发字符输入后弹窗是否出现
 * - 候选项过滤是否正确
 * - 键盘导航（ArrowUp/Down、Enter、Escape、Tab）
 * - 确认选中后文本是否正确插入
 * - onInsert 回调
 * - 非触发输入时弹窗不出现
 */

import type { LexicalEditor } from 'lexical'
import type { AutocompleteSource, AutocompleteSuggestion } from '../types'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { act, render, screen, waitFor } from '@testing-library/react'
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
} from 'lexical'
import { useEffect } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MentionNode } from '../../../nodes/MentionNode'
import { KeyboardPlugin } from '../../KeyboardPlugin'
import { AutocompletePlugin } from '../AutocompletePlugin'

// ─── 测试数据 ─────────────────────────────────────────────────────────────────

const AT_SUGGESTIONS: AutocompleteSuggestion[] = [
  { id: 'skill-1', label: 'file_system', description: '文件系统技能', type: 'skill' },
  { id: 'skill-2', label: 'code_reader', description: '代码阅读技能', type: 'skill' },
  { id: 'skill-3', label: 'file_search', description: '文件搜索技能', type: 'skill' },
  { id: 'skill-4', label: 'shell', description: 'Shell 命令', type: 'skill' },
  { id: 'skill-5', label: 'browser', description: '浏览器技能', type: 'skill' },
]

const HASH_SUGGESTIONS: AutocompleteSuggestion[] = [
  { id: 'file-1', label: 'README.md', description: 'README.md', type: 'file', insertText: '#README.md ' },
  { id: 'file-2', label: 'package.json', description: 'package.json', type: 'file', insertText: '#package.json ' },
]

const SLASH_SUGGESTIONS: AutocompleteSuggestion[] = [
  { id: 'cmd-1', label: 'clear', description: '清空对话', insertText: '/clear ' },
  { id: 'cmd-2', label: 'help', description: '帮助', insertText: '/help ' },
]

const TEST_SOURCES: AutocompleteSource[] = [
  { trigger: '@', title: '技能', suggestions: AT_SUGGESTIONS },
  { trigger: '#', title: '文件', suggestions: HASH_SUGGESTIONS },
  { trigger: '/', title: '命令', suggestions: SLASH_SUGGESTIONS },
]

// ─── 辅助组件 ─────────────────────────────────────────────────────────────────

/**
 * 捕获 Lexical editor 实例的插件
 */
function EditorRefPlugin({
  editorRef,
}: {
  editorRef: React.MutableRefObject<LexicalEditor | null>
}) {
  const [editor] = useLexicalComposerContext()
  useEffect(() => {
    editorRef.current = editor
  }, [editor, editorRef])
  return null
}

interface TestEditorProps {
  sources: AutocompleteSource[]
  onInsert?: (trigger: string, item: AutocompleteSuggestion) => void
  editorRef: React.MutableRefObject<LexicalEditor | null>
}

function TestEditor({ sources, onInsert, editorRef }: TestEditorProps) {
  const initialConfig = {
    namespace: 'autocomplete-test',
    nodes: [MentionNode],
    onError: (err: Error) => { throw err },
  }

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <RichTextPlugin
        contentEditable={<ContentEditable data-testid="editor" />}
        ErrorBoundary={LexicalErrorBoundary}
      />
      <EditorRefPlugin editorRef={editorRef} />
      <AutocompletePlugin sources={sources} onInsert={onInsert} />
    </LexicalComposer>
  )
}

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

/**
 * 向编辑器写入文本，并将光标置于末尾。
 * 直接操作 Lexical 内部状态以模拟用户真实输入。
 */
async function setEditorContent(editor: LexicalEditor, text: string) {
  await act(async () => {
    editor.update(
      () => {
        const root = $getRoot()
        root.clear()
        const para = $createParagraphNode()
        if (text) {
          const node = $createTextNode(text)
          para.append(node)
          node.select(text.length, text.length) // 光标置于末尾
        }
        else {
          para.select(0, 0)
        }
        root.append(para)
      },
      { discrete: true },
    )
  })
}

/**
 * 向编辑器分发键盘命令（模拟真实按键发送的 Lexical command）。
 */
async function pressKey(
  editor: LexicalEditor,
  command:
    | typeof KEY_ARROW_DOWN_COMMAND
    | typeof KEY_ARROW_UP_COMMAND
    | typeof KEY_ENTER_COMMAND
    | typeof KEY_ESCAPE_COMMAND
    | typeof KEY_TAB_COMMAND,
  eventInit: KeyboardEventInit = {},
) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...eventInit,
  })
  await act(async () => {
    editor.dispatchCommand(command, event as any)
  })
}

// ─── 测试辅助工厂 ─────────────────────────────────────────────────────────────

function setup(
  sources: AutocompleteSource[] = TEST_SOURCES,
  onInsert?: (trigger: string, item: AutocompleteSuggestion) => void,
) {
  const editorRef: React.MutableRefObject<LexicalEditor | null> = { current: null }
  render(<TestEditor sources={sources} onInsert={onInsert} editorRef={editorRef} />)

  const getEditor = () => {
    if (!editorRef.current)
      throw new Error('Editor not initialized')
    return editorRef.current
  }

  return {
    editorRef,
    getEditor,
    async type(text: string) {
      await setEditorContent(getEditor(), text)
    },
    async pressDown(n = 1) {
      for (let i = 0; i < n; i++) await pressKey(getEditor(), KEY_ARROW_DOWN_COMMAND)
    },
    async pressUp(n = 1) {
      for (let i = 0; i < n; i++) await pressKey(getEditor(), KEY_ARROW_UP_COMMAND)
    },
    async pressEnter() {
      await pressKey(getEditor(), KEY_ENTER_COMMAND)
    },
    async pressTab() {
      await pressKey(getEditor(), KEY_TAB_COMMAND)
    },
    async pressEscape() {
      await pressKey(getEditor(), KEY_ESCAPE_COMMAND)
    },
    /** 读取编辑器中第一个文本节点的内容 */
    getEditorText(): string {
      let text = ''
      getEditor().getEditorState().read(() => {
        text = $getRoot().getTextContent()
      })
      return text
    },
  }
}

// ─── 测试套件 ─────────────────────────────────────────────────────────────────

describe('弹窗显示与隐藏', () => {
  it('普通文本输入：弹窗不出现', async () => {
    const { type } = setup()

    await type('hello world')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('输入 @ 后弹窗出现，包含 @ 触发源候选项', async () => {
    const { type } = setup()

    await type('@')

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })
    // @ 无 query时候选项应展示（高亮无段，文本完整）
    const lb = screen.getByRole('listbox')
    expect(lb.textContent).toContain('file_system')
    expect(lb.textContent).toContain('code_reader')
  })

  it('输入 # 后弹窗出现，包含文件候选项', async () => {
    const { type } = setup()

    await type('#')

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })
    const lb = screen.getByRole('listbox')
    expect(lb.textContent).toContain('README.md')
    expect(lb.textContent).toContain('package.json')
  })

  it('输入 / 后弹窗出现，包含命令候选项', async () => {
    const { type } = setup()

    await type('/')

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })
    const lb = screen.getByRole('listbox')
    expect(lb.textContent).toContain('clear')
    expect(lb.textContent).toContain('help')
  })

  it('输入 @ 再清空：弹窗消失', async () => {
    const { type } = setup()

    await type('@')
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())

    await type('') // 清空内容
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
  })

  it('无匹配 query（@xyz）时弹窗不出现', async () => {
    const { type } = setup()

    await type('@xyz_not_exist_999')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('弹窗出现时显示 section 标题', async () => {
    const { type } = setup()

    await type('@')
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())
    expect(screen.getByText('技能')).toBeInTheDocument()
  })
})

describe('候选项过滤', () => {
  it('@file 过滤出含 "file" 的候选项', async () => {
    const { type } = setup()

    await type('@file')

    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())

    // 高亮会拆分标签文本，用 listbox.textContent 做包含性断言
    const lb = screen.getByRole('listbox')
    expect(lb.textContent).toContain('file_system')
    expect(lb.textContent).toContain('file_search')
    // code_reader 不包含 "file"
    expect(lb.textContent).not.toContain('code_reader')
  })

  it('@sh 过滤出 shell', async () => {
    const { type } = setup()

    await type('@sh')

    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())
    const lb = screen.getByRole('listbox')
    expect(lb.textContent).toContain('shell')
    expect(lb.textContent).not.toContain('browser')
  })

  it('@br 过滤出 browser', async () => {
    const { type } = setup()

    await type('@br')

    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())
    expect(screen.getByRole('listbox').textContent).toContain('browser')
  })

  it('/cl 过滤出 clear 命令', async () => {
    const { type } = setup()

    await type('/cl')

    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())
    const lb = screen.getByRole('listbox')
    expect(lb.textContent).toContain('clear')
    expect(lb.textContent).not.toContain('help')
  })
})

describe('键盘导航', () => {
  it('arrowDown 将高亮移至下一项（循环）', async () => {
    const { type, pressDown } = setup()

    await type('@')
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())

    // 初始第 0 项高亮
    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    expect(options[1]).toHaveAttribute('aria-selected', 'false')

    await pressDown()

    await waitFor(() => {
      const opts = screen.getAllByRole('option')
      expect(opts[0]).toHaveAttribute('aria-selected', 'false')
      expect(opts[1]).toHaveAttribute('aria-selected', 'true')
    })
  })

  it('arrowUp 在第一项时循环到最后一项', async () => {
    const { type, pressUp } = setup()

    await type('@')
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())

    const options = screen.getAllByRole('option')
    const total = options.length

    await pressUp()

    await waitFor(() => {
      const opts = screen.getAllByRole('option')
      expect(opts[total - 1]).toHaveAttribute('aria-selected', 'true')
    })
  })

  it('连续 arrowDown 两次，第 3 项高亮', async () => {
    const { type, pressDown } = setup()

    await type('@')
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())

    await pressDown(2)

    await waitFor(() => {
      const opts = screen.getAllByRole('option')
      expect(opts[2]).toHaveAttribute('aria-selected', 'true')
    })
  })

  it('escape 关闭弹窗', async () => {
    const { type, pressEscape } = setup()

    await type('@')
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())

    await pressEscape()

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBeNull()
    })
  })
})

describe('确认选中', () => {
  it('enter 确认选中默认第一项，弹窗关闭', async () => {
    const { type, pressEnter } = setup()

    await type('@')
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())

    await pressEnter()

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBeNull()
    })
  })

  it('tab 确认选中默认第一项，弹窗关闭', async () => {
    const { type, pressTab } = setup()

    await type('@')
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())

    await pressTab()

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBeNull()
    })
  })

  it('enter 后文本节点内容被替换为 insertText', async () => {
    const { type, pressEnter, getEditorText } = setup()

    // 输入 @file，应触发 file_system 为第一项
    await type('@file')
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())

    await pressEnter()

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())

    // MentionNode.getTextContent() 返回不含触发前缀的纯值 + 紧跟空格 TextNode
    const text = getEditorText()
    expect(text).toBe('file_system ')
  })

  it('# 触发源确认后使用自定义 insertText', async () => {
    const { type, pressEnter, getEditorText } = setup()

    await type('#read')
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())

    // README.md 是唯一匹配项，Enter 后 MentionNode 不含 # 前缀
    await pressEnter()

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())

    const text = getEditorText()
    expect(text).toBe('README.md ')
  })

  it('arrowDown + enter 选中指定项', async () => {
    const { type, pressDown, pressEnter, getEditorText } = setup()

    await type('@')
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())

    // 默认第 0 项 file_system，按 1 次 Down → code_reader
    await pressDown()
    await pressEnter()

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())

    const text = getEditorText()
    expect(text).toBe('code_reader ')
  })

  it('onInsert 回调被正确调用', async () => {
    const onInsert = vi.fn()
    const { type, pressEnter } = setup(TEST_SOURCES, onInsert as any)

    await type('@sh')
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())

    await pressEnter()

    await waitFor(() => {
      expect(onInsert).toHaveBeenCalledOnce()
      expect(onInsert).toHaveBeenCalledWith('@', expect.objectContaining({ label: 'shell' }))
    })
  })
})

describe('边界场景', () => {
  it('空格前的 @ 不触发（email 格式）', async () => {
    const { type } = setup()

    // "user@domain" 中 @ 前有非空白字符，不应触发
    await type('user@domain')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('空格后的 @ 触发弹窗', async () => {
    const { type } = setup()

    // @sh 匹配 shell，前缀文本带空格也应触发
    await type('hello @sh')

    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())
    expect(screen.getByRole('listbox').textContent).toContain('shell')
  })

  it('sources 为空数组时：输入 @ 不出现弹窗', async () => {
    const { type } = setup([])

    await type('@')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('动态 suggestions 函数：根据 query 返回结果', async () => {
    const dynamicSource: AutocompleteSource = {
      trigger: '@',
      title: '动态技能',
      suggestions: (query: string) =>
        AT_SUGGESTIONS.filter(s => s.label.startsWith(query)),
    }
    const { type } = setup([dynamicSource])

    await type('@file')

    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())
    const lb = screen.getByRole('listbox')
    expect(lb.textContent).toContain('file_system')
    expect(lb.textContent).toContain('file_search')
    expect(lb.textContent).not.toContain('shell')
  })
})

// ─── 键盘事件隔离测试 ─────────────────────────────────────────────────────────
//
// 验证：弹窗打开时，AutocompletePlugin 的 COMMAND_PRIORITY_CRITICAL 命令优先于
// KeyboardPlugin 的 COMMAND_PRIORITY_HIGH 命令执行，从而避免「确认选中」同时
// 触发「发送消息」等副作用。

interface TestEditorWithKeyboardProps {
  sources: AutocompleteSource[]
  editorRef: React.MutableRefObject<LexicalEditor | null>
  onEnter: () => void
  onEscape?: () => void
}

function TestEditorWithKeyboard({
  sources,
  editorRef,
  onEnter,
  onEscape,
}: TestEditorWithKeyboardProps) {
  const initialConfig = {
    namespace: 'autocomplete-isolation-test',
    nodes: [MentionNode],
    onError: (err: Error) => { throw err },
  }
  return (
    <LexicalComposer initialConfig={initialConfig}>
      <RichTextPlugin
        contentEditable={<ContentEditable data-testid="editor" />}
        ErrorBoundary={LexicalErrorBoundary}
      />
      <EditorRefPlugin editorRef={editorRef} />
      {/* KeyboardPlugin 先挂载，模拟 editor.tsx 中的真实顺序 */}
      <KeyboardPlugin onEnter={onEnter} onEscape={onEscape} />
      <AutocompletePlugin sources={sources} />
    </LexicalComposer>
  )
}

function setupWithKeyboard(onEnter: () => void, onEscape?: () => void) {
  const editorRef: React.MutableRefObject<LexicalEditor | null> = { current: null }
  render(
    <TestEditorWithKeyboard
      sources={TEST_SOURCES}
      editorRef={editorRef}
      onEnter={onEnter}
      onEscape={onEscape}
    />,
  )

  const getEditor = () => {
    if (!editorRef.current)
      throw new Error('Editor not initialized')
    return editorRef.current
  }

  return {
    async type(text: string) {
      await setEditorContent(getEditor(), text)
    },
    async pressEnter(eventInit: KeyboardEventInit = {}) {
      await pressKey(getEditor(), KEY_ENTER_COMMAND, eventInit)
    },
    async pressEscape() {
      await pressKey(getEditor(), KEY_ESCAPE_COMMAND)
    },
    async pressTab() {
      await pressKey(getEditor(), KEY_TAB_COMMAND)
    },
    async pressDown(n = 1) {
      for (let i = 0; i < n; i++) await pressKey(getEditor(), KEY_ARROW_DOWN_COMMAND)
    },
    async pressUp(n = 1) {
      for (let i = 0; i < n; i++) await pressKey(getEditor(), KEY_ARROW_UP_COMMAND)
    },
    getEditorText(): string {
      let text = ''
      getEditor().getEditorState().read(() => {
        text = $getRoot().getTextContent()
      })
      return text
    },
  }
}

describe('键盘事件隔离（autocomplete 与 KeyboardPlugin 不冲突）', () => {
  it('弹窗关闭时 enter 正常触发 onEnter（发送消息）', async () => {
    const onEnter = vi.fn().mockReturnValue(true)
    const { type, pressEnter } = setupWithKeyboard(onEnter)

    await type('hello')
    await pressEnter()

    expect(onEnter).toHaveBeenCalledOnce()
  })

  it('弹窗打开时 enter 确认选中，onEnter 不被调用', async () => {
    const onEnter = vi.fn().mockReturnValue(true)
    const { type, pressEnter } = setupWithKeyboard(onEnter)

    await type('@')
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())

    await pressEnter()

    // 弹窗已关闭（autocomplete 消费了 Enter）
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    // KeyboardPlugin 的 onEnter 不应被触发
    expect(onEnter).not.toHaveBeenCalled()
  })

  it('弹窗打开时 enter 不触发 onEnter，选中后弹窗关闭，文字被插入', async () => {
    const onEnter = vi.fn().mockReturnValue(true)
    const { type, pressEnter, getEditorText } = setupWithKeyboard(onEnter)

    await type('@file')
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())

    await pressEnter()

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    expect(onEnter).not.toHaveBeenCalled()
    expect(getEditorText()).toBe('file_system ')
  })

  it('弹窗打开时 shift+enter 不触发选中，让 lexical 执行默认换行', async () => {
    const onEnter = vi.fn().mockReturnValue(true)
    const { type, pressEnter, getEditorText } = setupWithKeyboard(onEnter)

    await type('@')
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())

    // Shift+Enter：AutocompletePlugin 对 shiftKey Enter 返回 false，不消费命令，
    // Lexical 默认行为（插入换行）执行，光标离开触发节点，弹窗自然关闭
    await pressEnter({ shiftKey: true })

    // 没有候选项被插入——文本里不包含任何 label（如 @file_system ）
    const text = getEditorText()
    expect(text).not.toMatch(/@\w+\s/)
    // 原始 @ 触发字符仍在（只是多了换行，不是被替换成候选项）
    expect(text).toContain('@')
  })

  it('弹窗打开时 escape 关闭弹窗，onEscape 不被调用', async () => {
    const onEnter = vi.fn()
    const onEscape = vi.fn().mockReturnValue(true)
    const { type, pressEscape } = setupWithKeyboard(onEnter, onEscape)

    await type('@')
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())

    await pressEscape()

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    // AutocompletePlugin 消费了 Escape，KeyboardPlugin 的 onEscape 不应被触发
    expect(onEscape).not.toHaveBeenCalled()
  })

  it('弹窗关闭后 escape 正常触发 onEscape', async () => {
    const onEnter = vi.fn()
    const onEscape = vi.fn().mockReturnValue(true)
    const { type, pressEscape } = setupWithKeyboard(onEnter, onEscape)

    await type('@')
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())

    // 先关闭弹窗
    await pressEscape()
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())

    // 再按 Escape，此时 AutocompletePlugin 未注册命令，KeyboardPlugin 正常接管
    await pressEscape()
    expect(onEscape).toHaveBeenCalledOnce()
  })

  it('弹窗打开时 arrowDown 不触发任何外部副作用', async () => {
    const onEnter = vi.fn()
    const { type, pressDown } = setupWithKeyboard(onEnter)

    await type('@')
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())

    // ArrowDown × 2，只移动高亮，不调用 onEnter
    await pressDown(2)

    await waitFor(() => {
      const opts = screen.getAllByRole('option')
      expect(opts[2]).toHaveAttribute('aria-selected', 'true')
    })
    expect(onEnter).not.toHaveBeenCalled()
  })

  it('确认选中后再按 enter，此时弹窗已关闭，onEnter 正常触发', async () => {
    const onEnter = vi.fn().mockReturnValue(true)
    const { type, pressEnter } = setupWithKeyboard(onEnter)

    await type('@sh')
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())

    // 第一次 Enter：确认选中
    await pressEnter()
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    expect(onEnter).not.toHaveBeenCalled()

    // 第二次 Enter：弹窗已关闭，KeyboardPlugin 接管，onEnter 应被调用
    await pressEnter()
    expect(onEnter).toHaveBeenCalledOnce()
  })
})
