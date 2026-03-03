/**
 * @fileoverview Tests for virtual-list/utils.ts — pure utility functions
 */

import {
  alignmentToBlock,
  captureScrollAnchor,
  clampIndex,
  defaultGetItemKey,
  getScrollDirection,
  isScrolledToBottom,
  isScrolledToTop,
  rafThrottle,
  scrollElementToBottom,
  scrollElementToTop,
} from '../utils'

// ─── helpers ──────────────────────────────────────────────────────────────────

/** 创建一个带可控滚动属性的 HTMLElement stub */
function makeScrollEl(
  overrides: Partial<{
    scrollTop: number
    scrollHeight: number
    clientHeight: number
    scrollLeft: number
  }> = {},
): HTMLElement {
  const el = document.createElement('div')
  Object.defineProperties(el, {
    scrollTop: {
      get: () => overrides.scrollTop ?? 0,
      set: (v) => { overrides.scrollTop = v },
      configurable: true,
    },
    scrollHeight: {
      get: () => overrides.scrollHeight ?? 0,
      configurable: true,
    },
    clientHeight: {
      get: () => overrides.clientHeight ?? 0,
      configurable: true,
    },
  })
  return el
}

// ─── isScrolledToBottom ───────────────────────────────────────────────────────

describe('isScrolledToBottom', () => {
  it('returns true when scrolled exactly to bottom', () => {
    const el = makeScrollEl({ scrollTop: 920, scrollHeight: 1000, clientHeight: 80 })
    expect(isScrolledToBottom(el, 80)).toBe(true)
  })

  it('returns true when within threshold of bottom', () => {
    // remaining = 1000 - 930 - 80 = -10 → -10 <= 80
    const el = makeScrollEl({ scrollTop: 930, scrollHeight: 1000, clientHeight: 80 })
    expect(isScrolledToBottom(el, 80)).toBe(true)
  })

  it('returns false when far from bottom', () => {
    // remaining = 1000 - 0 - 80 = 920 → 920 > 80
    const el = makeScrollEl({ scrollTop: 0, scrollHeight: 1000, clientHeight: 80 })
    expect(isScrolledToBottom(el, 80)).toBe(false)
  })

  it('uses default threshold of 80', () => {
    // remaining = 1000 - 840 - 80 = 80 → exactly at threshold
    const el = makeScrollEl({ scrollTop: 840, scrollHeight: 1000, clientHeight: 80 })
    expect(isScrolledToBottom(el)).toBe(true)
  })

  it('returns false just outside default threshold', () => {
    // remaining = 1000 - 839 - 80 = 81 → 81 > 80
    const el = makeScrollEl({ scrollTop: 839, scrollHeight: 1000, clientHeight: 80 })
    expect(isScrolledToBottom(el)).toBe(false)
  })
})

// ─── isScrolledToTop ──────────────────────────────────────────────────────────

describe('isScrolledToTop', () => {
  it('returns true when scrollTop is 0', () => {
    const el = makeScrollEl({ scrollTop: 0 })
    expect(isScrolledToTop(el)).toBe(true)
  })

  it('returns true when scrollTop is within threshold', () => {
    const el = makeScrollEl({ scrollTop: 49 })
    expect(isScrolledToTop(el, 50)).toBe(true)
  })

  it('returns false when scrollTop exceeds threshold', () => {
    const el = makeScrollEl({ scrollTop: 51 })
    expect(isScrolledToTop(el, 50)).toBe(false)
  })

  it('uses default threshold of 50', () => {
    const el = makeScrollEl({ scrollTop: 50 })
    expect(isScrolledToTop(el)).toBe(true)
  })
})

// ─── scrollElementToBottom ────────────────────────────────────────────────────

describe('scrollElementToBottom', () => {
  it('calls scrollTo with top = scrollHeight', () => {
    const el = document.createElement('div')
    Object.defineProperty(el, 'scrollHeight', { get: () => 2000 })
    const spy = vi.spyOn(el, 'scrollTo')

    scrollElementToBottom(el, 'smooth')

    expect(spy).toHaveBeenCalledWith({ top: 2000, behavior: 'smooth' })
  })

  it('uses smooth as default behavior', () => {
    const el = document.createElement('div')
    Object.defineProperty(el, 'scrollHeight', { get: () => 500 })
    const spy = vi.spyOn(el, 'scrollTo')

    scrollElementToBottom(el)

    expect(spy).toHaveBeenCalledWith({ top: 500, behavior: 'smooth' })
  })

  it('supports instant behavior', () => {
    const el = document.createElement('div')
    Object.defineProperty(el, 'scrollHeight', { get: () => 500 })
    const spy = vi.spyOn(el, 'scrollTo')

    scrollElementToBottom(el, 'instant')

    expect(spy).toHaveBeenCalledWith({ top: 500, behavior: 'instant' })
  })
})

// ─── scrollElementToTop ───────────────────────────────────────────────────────

describe('scrollElementToTop', () => {
  it('calls scrollTo with top = 0', () => {
    const el = document.createElement('div')
    const spy = vi.spyOn(el, 'scrollTo')

    scrollElementToTop(el, 'instant')

    expect(spy).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
  })

  it('uses smooth as default behavior', () => {
    const el = document.createElement('div')
    const spy = vi.spyOn(el, 'scrollTo')

    scrollElementToTop(el)

    expect(spy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })
})

// ─── getScrollDirection ───────────────────────────────────────────────────────

describe('getScrollDirection', () => {
  it('returns "up" when current < prev', () => {
    expect(getScrollDirection(100, 50)).toBe('up')
  })

  it('returns "down" when current > prev', () => {
    expect(getScrollDirection(50, 100)).toBe('down')
  })

  it('returns "none" when equal', () => {
    expect(getScrollDirection(100, 100)).toBe('none')
  })

  it('returns "none" for both zero', () => {
    expect(getScrollDirection(0, 0)).toBe('none')
  })
})

// ─── alignmentToBlock ─────────────────────────────────────────────────────────

describe('alignmentToBlock', () => {
  it('maps "start" → "start"', () => {
    expect(alignmentToBlock('start')).toBe('start')
  })

  it('maps "center" → "center"', () => {
    expect(alignmentToBlock('center')).toBe('center')
  })

  it('maps "end" → "end"', () => {
    expect(alignmentToBlock('end')).toBe('end')
  })

  it('maps "auto" → "nearest"', () => {
    expect(alignmentToBlock('auto')).toBe('nearest')
  })
})

// ─── clampIndex ───────────────────────────────────────────────────────────────

describe('clampIndex', () => {
  it('clamps below 0 to 0', () => {
    expect(clampIndex(-5, 10)).toBe(0)
  })

  it('clamps above last index to last', () => {
    expect(clampIndex(999, 10)).toBe(9)
  })

  it('passes through valid middle index', () => {
    expect(clampIndex(5, 10)).toBe(5)
  })

  it('returns 0 when length is 0', () => {
    expect(clampIndex(3, 0)).toBe(0)
  })

  it('handles index = last (length - 1)', () => {
    expect(clampIndex(9, 10)).toBe(9)
  })
})

// ─── captureScrollAnchor ──────────────────────────────────────────────────────

describe('captureScrollAnchor', () => {
  it('compensates scrollTop when scrollHeight grows after prepend', () => {
    let _scrollTop = 200
    const el = document.createElement('div')

    // Step 1: scrollHeight = 1000, scrollTop = 200
    let currentScrollHeight = 1000
    Object.defineProperties(el, {
      scrollTop: {
        get: () => _scrollTop,
        set: (v) => { _scrollTop = v },
        configurable: true,
      },
      scrollHeight: {
        get: () => currentScrollHeight,
        configurable: true,
      },
    })

    const restore = captureScrollAnchor(el)

    // Step 2: Simulate prepend — scrollHeight grows by 300
    currentScrollHeight = 1300

    restore()

    // scrollTop should be compensated: 200 + (1300 - 1000) = 500
    expect(_scrollTop).toBe(500)
  })

  it('does not change scrollTop when scrollHeight is unchanged', () => {
    let _scrollTop = 100
    const el = document.createElement('div')
    let currentScrollHeight = 800

    Object.defineProperties(el, {
      scrollTop: {
        get: () => _scrollTop,
        set: (v) => { _scrollTop = v },
        configurable: true,
      },
      scrollHeight: {
        get: () => currentScrollHeight,
        configurable: true,
      },
    })

    const restore = captureScrollAnchor(el)
    // No change in scrollHeight
    restore()

    expect(_scrollTop).toBe(100)
  })

  it('does not apply negative delta (content shrink is ignored)', () => {
    let _scrollTop = 300
    const el = document.createElement('div')
    let currentScrollHeight = 1000

    Object.defineProperties(el, {
      scrollTop: {
        get: () => _scrollTop,
        set: (v) => { _scrollTop = v },
        configurable: true,
      },
      scrollHeight: {
        get: () => currentScrollHeight,
        configurable: true,
      },
    })

    const restore = captureScrollAnchor(el)
    // Content somehow shrank
    currentScrollHeight = 800
    restore()

    // delta = 800 - 1000 = -200 → not > 0, no compensation
    expect(_scrollTop).toBe(300)
  })
})

// ─── rafThrottle ──────────────────────────────────────────────────────────────

describe('rafThrottle', () => {
  // NOTE: 不使用 vi.useFakeTimers()。
  // test-setup.ts 已将 requestAnimationFrame 替换为同步执行的 stub：
  //   requestAnimationFrame(cb) → cb(0) 立即执行 → return 0
  // 因此 rafThrottle 的行为为：
  //   ① rafId = requestAnimationFrame(cb)  [赋值表达式，先求右值]
  //   ② 右值执行中：cb 同步调用 → fn() → rafId = null（设为 null）
  //   ③ 右值返回 0 → rafId = 0（覆盖 null）
  // 结论：首次调用 fn 被同步触发，但 rafId 最终 = 0（非 null），
  //       后续调用被 "if (rafId != null) return" 屏蔽——这是预期的节流行为。

  it('calls the fn immediately on first invocation', () => {
    const fn = vi.fn()
    const throttled = rafThrottle(fn)
    throttled()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('passes arguments through to fn', () => {
    const fn = vi.fn()
    const throttled = rafThrottle(fn)
    throttled('a', 'b')
    expect(fn).toHaveBeenCalledWith('a', 'b')
  })

  it('suppresses rapid subsequent calls (throttling behavior)', () => {
    // 因为同步 rAF stub 导致 rafId 最终为 0（非 null），
    // 连续两次调用只执行一次。这正是节流的预期行为。
    const fn = vi.fn()
    const throttled = rafThrottle(fn)
    throttled()
    throttled() // rafId != null → suppressed
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

// ─── defaultGetItemKey ────────────────────────────────────────────────────────

describe('defaultGetItemKey', () => {
  it('returns the index as the key', () => {
    expect(defaultGetItemKey('anything', 3)).toBe(3)
    expect(defaultGetItemKey({ id: 'x' }, 0)).toBe(0)
  })
})
