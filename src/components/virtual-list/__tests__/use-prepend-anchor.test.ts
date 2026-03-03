/**
 * @fileoverview Tests for usePrependAnchor hook
 */

import type { RefObject } from 'react'
import { act } from 'react'
import { renderHook } from '@testing-library/react'
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
  it('returns beforePrepend and afterPrepend functions', () => {
    const { ref } = makeElRef({ scrollTop: 0, scrollHeight: 500 })

    const { result } = renderHook(() => usePrependAnchor(ref))

    expect(typeof result.current.beforePrepend).toBe('function')
    expect(typeof result.current.afterPrepend).toBe('function')
  })

  it('compensates scrollTop when content height grows after beforePrepend', () => {
    const { el, ref } = makeElRef({ scrollTop: 200, scrollHeight: 1000 })

    const { result } = renderHook(() => usePrependAnchor(ref))

    act(() => {
      result.current.beforePrepend()
    })

    // Simulate prepend → scrollHeight grows by 300
    ;(el as any).scrollHeight = 1300

    act(() => {
      result.current.afterPrepend()
    })

    // scrollTop should be adjusted: 200 + (1300 - 1000) = 500
    expect((el as any).scrollTop).toBe(500)
  })

  it('does NOT change scrollTop when scrollHeight is unchanged', () => {
    const { el, ref } = makeElRef({ scrollTop: 150, scrollHeight: 800 })

    const { result } = renderHook(() => usePrependAnchor(ref))

    act(() => {
      result.current.beforePrepend()
    })

    // No change in scrollHeight
    act(() => {
      result.current.afterPrepend()
    })

    expect((el as any).scrollTop).toBe(150)
  })

  it('afterPrepend is idempotent — calling twice does not double-compensate', () => {
    const { el, ref } = makeElRef({ scrollTop: 100, scrollHeight: 500 })

    const { result } = renderHook(() => usePrependAnchor(ref))

    act(() => {
      result.current.beforePrepend()
    })

    ;(el as any).scrollHeight = 700

    act(() => {
      result.current.afterPrepend()
      result.current.afterPrepend() // second call should be no-op
    })

    // Expected: 100 + (700 - 500) = 300 (only once)
    expect((el as any).scrollTop).toBe(300)
  })

  it('does nothing when ref.current is null', () => {
    const nullRef = { current: null } as RefObject<HTMLElement | null>

    // Should not throw
    const { result } = renderHook(() => usePrependAnchor(nullRef))

    expect(() => {
      act(() => {
        result.current.beforePrepend()
        result.current.afterPrepend()
      })
    }).not.toThrow()
  })

  it('does not compensate when content shrinks (delta <= 0)', () => {
    const { el, ref } = makeElRef({ scrollTop: 300, scrollHeight: 1000 })

    const { result } = renderHook(() => usePrependAnchor(ref))

    act(() => {
      result.current.beforePrepend()
    })

    // Content shrank
    ;(el as any).scrollHeight = 800

    act(() => {
      result.current.afterPrepend()
    })

    // delta = 800 - 1000 = -200 → not > 0, no change
    expect((el as any).scrollTop).toBe(300)
  })

  it('handles multiple sequential prepend cycles correctly', () => {
    const { el, ref } = makeElRef({ scrollTop: 0, scrollHeight: 500 })

    const { result } = renderHook(() => usePrependAnchor(ref))

    // ── Cycle 1: add 200px of content ────────────────────────────────────────
    act(() => { result.current.beforePrepend() })
    ;(el as any).scrollHeight = 700
    act(() => { result.current.afterPrepend() })
    expect((el as any).scrollTop).toBe(200) // 0 + 200

    // ── Cycle 2: add another 100px ────────────────────────────────────────────
    act(() => { result.current.beforePrepend() })
    ;(el as any).scrollHeight = 800
    act(() => { result.current.afterPrepend() })
    expect((el as any).scrollTop).toBe(300) // 200 + 100
  })
})
