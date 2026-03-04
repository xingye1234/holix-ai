import type { AutocompleteSuggestion } from '../types'
import { describe, expect, it } from 'vitest'
import { detectTrigger, filterSuggestions, formatInsertText, highlightLabel } from '../detect'

// ─── detectTrigger ────────────────────────────────────────────────────────────

describe('detectTrigger', () => {
  it('行首 @ 加 query', () => {
    const result = detectTrigger('@skill')
    expect(result).toEqual({ trigger: '@', query: 'skill', triggerOffset: 0 })
  })

  it('空格后 @ 加 query', () => {
    const result = detectTrigger('hello @skill')
    expect(result).toEqual({ trigger: '@', query: 'skill', triggerOffset: 6 })
  })

  it('@ 后无字符（空 query）', () => {
    const result = detectTrigger('@')
    expect(result).toEqual({ trigger: '@', query: '', triggerOffset: 0 })
  })

  it('中间有空格，query 段之后再有 @，仅匹配最后一段', () => {
    // '@foo bar' → query 中不含空白，bar 之前的 @ 不在最末尾匹配
    const result = detectTrigger('@foo bar')
    expect(result).toBeNull()
  })

  it('email 格式不匹配（@ 前无空白）', () => {
    const result = detectTrigger('user@domain.com')
    expect(result).toBeNull()
  })

  it('# 触发', () => {
    const result = detectTrigger('#file')
    expect(result).toEqual({ trigger: '#', query: 'file', triggerOffset: 0 })
  })

  it('空格后 #', () => {
    const result = detectTrigger('look at #readme')
    expect(result).toEqual({ trigger: '#', query: 'readme', triggerOffset: 8 })
  })

  it('/ 触发', () => {
    const result = detectTrigger('/clear')
    expect(result).toEqual({ trigger: '/', query: 'clear', triggerOffset: 0 })
  })

  it('纯文本无触发', () => {
    expect(detectTrigger('plain text')).toBeNull()
  })

  it('空字符串无触发', () => {
    expect(detectTrigger('')).toBeNull()
  })

  it('换行后 @', () => {
    // 换行符属于 [\s\n]，应当触发
    const result = detectTrigger('line1\n@skill')
    expect(result).toEqual({ trigger: '@', query: 'skill', triggerOffset: 6 })
  })

  it('多个词后的 @，triggerOffset 正确', () => {
    // 'foo bar @baz' → @ 在索引 8
    const result = detectTrigger('foo bar @baz')
    expect(result).toEqual({ trigger: '@', query: 'baz', triggerOffset: 8 })
  })
})

// ─── filterSuggestions ────────────────────────────────────────────────────────

const SUGGESTIONS: AutocompleteSuggestion[] = [
  { id: '1', label: 'file_system' },
  { id: '2', label: 'code_reader' },
  { id: '3', label: 'file_search' },
  { id: '4', label: 'browser' },
  { id: '5', label: 'web_search' },
  { id: '6', label: 'shell' },
  { id: '7', label: 'terminal' },
  { id: '8', label: 'git' },
  { id: '9', label: 'database' },
  { id: '10', label: 'translate' },
]

describe('filterSuggestions', () => {
  it('空 query 返回前 maxCount 条', () => {
    const result = filterSuggestions(SUGGESTIONS, '', 5)
    expect(result).toHaveLength(5)
    expect(result[0].id).toBe('1')
  })

  it('默认 maxCount 为 8', () => {
    const result = filterSuggestions(SUGGESTIONS, '')
    expect(result).toHaveLength(8)
  })

  it('按 label 过滤（忽略大小写）', () => {
    const result = filterSuggestions(SUGGESTIONS, 'FILE')
    // file_system, file_search 匹配（前缀优先），无顺序错乱
    expect(result.map(r => r.id)).toContain('1')
    expect(result.map(r => r.id)).toContain('3')
    expect(result).not.toContainEqual(expect.objectContaining({ label: 'browser' }))
  })

  it('前缀匹配优先于包含匹配', () => {
    // 'file' → file_system & file_search 优先（前缀），code_reader 不匹配
    const extras: AutocompleteSuggestion[] = [
      { id: 'a', label: 'list_files' }, // 包含 file，非前缀
      { id: 'b', label: 'file_ops' }, // 前缀
    ]
    const list = [...extras, ...SUGGESTIONS]
    const result = filterSuggestions(list, 'file')
    const ids = result.map(r => r.id)
    // 前缀匹配（b, 1, 3）先出现
    expect(ids.indexOf('b')).toBeLessThan(ids.indexOf('a'))
  })

  it('无匹配时返回空数组', () => {
    const result = filterSuggestions(SUGGESTIONS, 'zzz')
    expect(result).toHaveLength(0)
  })

  it('respects maxCount', () => {
    const result = filterSuggestions(SUGGESTIONS, '', 3)
    expect(result).toHaveLength(3)
  })
})

// ─── formatInsertText ─────────────────────────────────────────────────────────

describe('formatInsertText', () => {
  it('无自定义 insertText 时使用默认格式', () => {
    const s: AutocompleteSuggestion = { id: '1', label: 'file_system' }
    expect(formatInsertText('@', s)).toBe('@file_system ')
  })

  it('有自定义 insertText 时使用自定义值', () => {
    const s: AutocompleteSuggestion = { id: '1', label: 'clear', insertText: '/clear\n' }
    expect(formatInsertText('/', s)).toBe('/clear\n')
  })

  it('# 触发', () => {
    const s: AutocompleteSuggestion = { id: '1', label: 'README.md' }
    expect(formatInsertText('#', s)).toBe('#README.md ')
  })
})

// ─── highlightLabel ───────────────────────────────────────────────────────────

describe('highlightLabel', () => {
  it('query 为空时返回整个 label 为非高亮', () => {
    const segs = highlightLabel('file_system', '')
    expect(segs).toEqual([{ text: 'file_system', highlight: false }])
  })

  it('前缀匹配高亮', () => {
    const segs = highlightLabel('file_system', 'file')
    expect(segs).toEqual([
      { text: 'file', highlight: true },
      { text: '_system', highlight: false },
    ])
  })

  it('中间匹配高亮', () => {
    const segs = highlightLabel('code_reader', 'read')
    expect(segs).toEqual([
      { text: 'code_', highlight: false },
      { text: 'read', highlight: true },
      { text: 'er', highlight: false },
    ])
  })

  it('全匹配', () => {
    const segs = highlightLabel('git', 'git')
    expect(segs).toEqual([{ text: 'git', highlight: true }])
  })

  it('大小写不敏感', () => {
    const segs = highlightLabel('FileSystem', 'file')
    expect(segs[0]).toEqual({ text: 'File', highlight: true })
  })

  it('label 中无 query 时返回整体非高亮', () => {
    const segs = highlightLabel('browser', 'zzz')
    expect(segs).toEqual([{ text: 'browser', highlight: false }])
  })
})
