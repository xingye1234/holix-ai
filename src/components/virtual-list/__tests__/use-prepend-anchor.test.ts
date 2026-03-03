/**
 * @fileoverview usePrependAnchor hook 单元测试
 *
 * 该 hook 用于在虚拟列表顶部预插入历史消息时，
 * 通过快照 / 补偿 scrollHeight 差值来避免视口跳动。
 * 测试中使用 Object.defineProperty 控制 scrollTop / scrollHeight
 * 的 getter/setter，绕开 happy-dom 对非可滚动元素的限制。
 */

import type { RefObject } from 'react'
import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { usePrependAnchor } from '../hooks/use-prepend-anchor'

// ─── helpers ──────────────────────────────────────────────────────────────────

interface FakeScrollEl {
  scrollTop: number
  scrollHeight: number
}

/**
 * 创建一个带可控 scrollTop / scrollHeight 的 DOM 元素及其 ref
 */
function makeElRef(init: FakeScrollEl): {
  el: HTMLElement
  ref: RefObject<HTMLElement | null>
} {
  const el = document.createElement('div')

  let _scrollTop = init.scrollTop
  let _scrollHeight = init.scrollHeight

  Object.defineProperties(el, {
    scrollTop: {
      get: () => _scrollTop,
      set: (v: number) => { _scrollTop = v },
      configurable: true,
    },
    scrollHeight: {
      get: () => _scrollHeight,
      set: (v: number) => { _scrollHeight = v },
      configurable: true,
    },
  })

  const ref = { current: el } as RefObject<HTMLElement>
  return { el, ref }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('usePrependAnchor', () => {
  it('返回 beforePrepend 和 afterPrepend 两个函数', () => {
    const { ref } = makeElRef({ scrollTop: 0, scrollHeight: 500 })

    const { result } = renderHook(() => usePrependAnchor(ref))

    expect(typeof result.current.beforePrepend).toBe('function')
    expect(typeof result.current.afterPrepend).toBe('function')
  })

  it('插入内容后 scrollHeight 增大时，afterPrepend 自动补偿 scrollTop', () => {
    const { el, ref } = makeElRef({ scrollTop: 200, scrollHeight: 1000 })

    const { result } = renderHook(() => usePrependAnchor(ref))

    act(() => {
      result.current.beforePrepend()
    })

    // 模拟顶部插入内容 → scrollHeight 增加 300
    ;(el as any).scrollHeight = 1300

    act(() => {
      result.current.afterPrepend()
    })

    // 期望 scrollTop 被补偿：200 + (1300 - 1000) = 500
    expect((el as any).scrollTop).toBe(500)
  })

  it('scrollHeight 未变化时不修改 scrollTop', () => {
    const { el, ref } = makeElRef({ scrollTop: 150, scrollHeight: 800 })

    const { result } = renderHook(() => usePrependAnchor(ref))

    act(() => {
      result.current.beforePrepend()
    })

    // scrollHeight 未变化，delta = 0
    act(() => {
      result.current.afterPrepend()
    })

    expect((el as any).scrollTop).toBe(150)
  })

  it('afterPrepend 幂等：重复调用不会重复补偿 scrollTop', () => {
    const { el, ref } = makeElRef({ scrollTop: 100, scrollHeight: 500 })

    const { result } = renderHook(() => usePrependAnchor(ref))

    act(() => {
      result.current.beforePrepend()
    })

    ;(el as any).scrollHeight = 700

    act(() => {
      result.current.afterPrepend()
      result.current.afterPrepend() // 第二次调用应为空操作（幂等）
    })

    // 期望只补偿一次：100 + (700 - 500) = 300
    expect((el as any).scrollTop).toBe(300)
  })

  it('ref.current 为 null 时不报错也不执行任何操作', () => {
    const nullRef = { current: null } as RefObject<HTMLElement | null>

    // 不应抛出异常
    const { result } = renderHook(() => usePrependAnchor(nullRef))

    expect(() => {
      act(() => {
        result.current.beforePrepend()
        result.current.afterPrepend()
      })
    }).not.toThrow()
  })

  it('内容缩短（delta ≤ 0）时不补偿 scrollTop', () => {
    const { el, ref } = makeElRef({ scrollTop: 300, scrollHeight: 1000 })

    const { result } = renderHook(() => usePrependAnchor(ref))

    act(() => {
      result.current.beforePrepend()
    })

    // 模拟内容缩短
    ;(el as any).scrollHeight = 800

    act(() => {
      result.current.afterPrepend()
    })

    // delta = 800 - 1000 = -200 → 不满足 > 0，不补偿
    expect((el as any).scrollTop).toBe(300)
  })

  it('多次连续插入周期均能正确依次补偿 scrollTop', () => {
    const { el, ref } = makeElRef({ scrollTop: 0, scrollHeight: 500 })

    const { result } = renderHook(() => usePrependAnchor(ref))

    // ── 第一轮：插入 200px 的内容 ──────────────────────────────────────────
    act(() => {
      result.current.beforePrepend()
    })
    ;(el as any).scrollHeight = 700
    act(() => {
      result.current.afterPrepend()
    })
    expect((el as any).scrollTop).toBe(200) // 0 + 200

    // ── 第二轮：再插入 100px 的内容 ──────────────────────────────────────────
    act(() => {
      result.current.beforePrepend()
    })
    ;(el as any).scrollHeight = 800
    act(() => {
      result.current.afterPrepend()
    })
    expect((el as any).scrollTop).toBe(300) // 200 + 100
  })
})
