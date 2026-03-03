/**
 * @fileoverview virtual-list/utils.ts 工具函数单元测试
 *
 * 全部为纯函数，无 React 依赖，直接操作 DOM stub 验证滚动判断、
 * 滚动操作、方向检测、索引钳制、锚点捕获及节流逻辑。
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

// ─── isScrolledToBottom：判断是否滚动到底部 ──────────────────────────────────
// 公式：scrollHeight - scrollTop - clientHeight ≤ threshold

describe('isScrolledToBottom', () => {
  it('精确滚动到底部时返回 true', () => {
    const el = makeScrollEl({ scrollTop: 920, scrollHeight: 1000, clientHeight: 80 })
    expect(isScrolledToBottom(el, 80)).toBe(true)
  })

  it('在底部阈值范围内时返回 true', () => {
    // remaining = 1000 - 930 - 80 = -10 → -10 <= 80
    const el = makeScrollEl({ scrollTop: 930, scrollHeight: 1000, clientHeight: 80 })
    expect(isScrolledToBottom(el, 80)).toBe(true)
  })

  it('距底部较远时返回 false', () => {
    // remaining = 1000 - 0 - 80 = 920 → 920 > 80
    const el = makeScrollEl({ scrollTop: 0, scrollHeight: 1000, clientHeight: 80 })
    expect(isScrolledToBottom(el, 80)).toBe(false)
  })

  it('使用默认阈值 80 的边界判断', () => {
    // remaining = 1000 - 840 - 80 = 80 → 恰好等于阈值，视为到底
    const el = makeScrollEl({ scrollTop: 840, scrollHeight: 1000, clientHeight: 80 })
    expect(isScrolledToBottom(el)).toBe(true)
  })

  it('恰好超出默认阈值时返回 false', () => {
    // remaining = 1000 - 839 - 80 = 81 → 81 > 80，不在范围内
    const el = makeScrollEl({ scrollTop: 839, scrollHeight: 1000, clientHeight: 80 })
    expect(isScrolledToBottom(el)).toBe(false)
  })
})

// ─── isScrolledToTop：判断是否滚动到顶部 ────────────────────────────────────
// 公式：scrollTop ≤ threshold

describe('isScrolledToTop', () => {
  it('scrollTop 为 0 时返回 true', () => {
    const el = makeScrollEl({ scrollTop: 0 })
    expect(isScrolledToTop(el)).toBe(true)
  })

  it('scrollTop 在阈值范围内时返回 true', () => {
    const el = makeScrollEl({ scrollTop: 49 })
    expect(isScrolledToTop(el, 50)).toBe(true)
  })

  it('scrollTop 超出阈值时返回 false', () => {
    const el = makeScrollEl({ scrollTop: 51 })
    expect(isScrolledToTop(el, 50)).toBe(false)
  })

  it('使用默认阈值 50 的边界判断', () => {
    const el = makeScrollEl({ scrollTop: 50 })
    expect(isScrolledToTop(el)).toBe(true)
  })
})

// ─── scrollElementToBottom：滚动到元素底部 ─────────────────────────────────
// 内部调用 el.scrollTo({ top: scrollHeight, behavior })

describe('scrollElementToBottom', () => {
  it('调用 scrollTo 时 top 等于 scrollHeight', () => {
    const el = document.createElement('div')
    Object.defineProperty(el, 'scrollHeight', { get: () => 2000 })
    const spy = vi.spyOn(el, 'scrollTo')

    scrollElementToBottom(el, 'smooth')

    expect(spy).toHaveBeenCalledWith({ top: 2000, behavior: 'smooth' })
  })

  it('默认滚动动画为 smooth', () => {
    const el = document.createElement('div')
    Object.defineProperty(el, 'scrollHeight', { get: () => 500 })
    const spy = vi.spyOn(el, 'scrollTo')

    scrollElementToBottom(el)

    expect(spy).toHaveBeenCalledWith({ top: 500, behavior: 'smooth' })
  })

  it('支持 instant 即时滚动', () => {
    const el = document.createElement('div')
    Object.defineProperty(el, 'scrollHeight', { get: () => 500 })
    const spy = vi.spyOn(el, 'scrollTo')

    scrollElementToBottom(el, 'instant')

    expect(spy).toHaveBeenCalledWith({ top: 500, behavior: 'instant' })
  })
})

// ─── scrollElementToTop：滚动到元素顶部 ────────────────────────────────────
// 内部调用 el.scrollTo({ top: 0, behavior })

describe('scrollElementToTop', () => {
  it('调用 scrollTo 时 top 等于 0', () => {
    const el = document.createElement('div')
    const spy = vi.spyOn(el, 'scrollTo')

    scrollElementToTop(el, 'instant')

    expect(spy).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
  })

  it('默认滚动动画为 smooth', () => {
    const el = document.createElement('div')
    const spy = vi.spyOn(el, 'scrollTo')

    scrollElementToTop(el)

    expect(spy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })
})

// ─── getScrollDirection：判断滚动方向 ───────────────────────────────────────
// 比较前后两次 scrollTop，返回 'up' | 'down' | 'none'

describe('getScrollDirection', () => {
  it('当前值小于前值时返回 "up"（向上滚动）', () => {
    expect(getScrollDirection(100, 50)).toBe('up')
  })

  it('当前值大于前值时返回 "down"（向下滚动）', () => {
    expect(getScrollDirection(50, 100)).toBe('down')
  })

  it('前后值相同时返回 "none"（未滚动）', () => {
    expect(getScrollDirection(100, 100)).toBe('none')
  })

  it('均为 0 时返回 "none"', () => {
    expect(getScrollDirection(0, 0)).toBe('none')
  })
})

// ─── alignmentToBlock：ScrollAlignment → CSS scroll-snap-align 映射 ─────────
// 用于将虚拟列表对齐参数转换为 scrollIntoView 的 block 选项

describe('alignmentToBlock', () => {
  it('"start" 映射为 "start"', () => {
    expect(alignmentToBlock('start')).toBe('start')
  })

  it('"center" 映射为 "center"', () => {
    expect(alignmentToBlock('center')).toBe('center')
  })

  it('"end" 映射为 "end"', () => {
    expect(alignmentToBlock('end')).toBe('end')
  })

  it('"auto" 映射为 "nearest"（就近对齐）', () => {
    expect(alignmentToBlock('auto')).toBe('nearest')
  })
})

// ─── clampIndex：将索引钳制在合法范围内 ────────────────────────────────────
// 确保 0 ≤ index < length，防止越界访问

describe('clampIndex', () => {
  it('负数索引被钳制为 0', () => {
    expect(clampIndex(-5, 10)).toBe(0)
  })

  it('超出末尾的索引被钳制为最后一个有效索引', () => {
    expect(clampIndex(999, 10)).toBe(9)
  })

  it('合法的中间索引直接透传', () => {
    expect(clampIndex(5, 10)).toBe(5)
  })

  it('列表为空（length=0）时返回 0', () => {
    expect(clampIndex(3, 0)).toBe(0)
  })

  it('恰好等于最后一个有效索引时透传', () => {
    expect(clampIndex(9, 10)).toBe(9)
  })
})

// ─── captureScrollAnchor：预插入时的滚动锚点捕获与补偿 ─────────────────────
// 调用时快照当前 scrollHeight，返回补偿函数：
// 补偿量 = 新 scrollHeight - 旧 scrollHeight（仅在正增量时生效）

describe('captureScrollAnchor', () => {
  it('插入内容后 scrollHeight 增大时补偿 scrollTop', () => {
    let _scrollTop = 200
    const el = document.createElement('div')

    // 初始状态：scrollHeight = 1000，scrollTop = 200
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

    // 模拟顶部插入内容 → scrollHeight 增加 300
    currentScrollHeight = 1300

    restore() // 执行补偿

    // 期望 scrollTop 被补偿：200 + (1300 - 1000) = 500
    expect(_scrollTop).toBe(500)
  })

  it('scrollHeight 未变化时不修改 scrollTop', () => {
    let _scrollTop = 100
    const el = document.createElement('div')
    const currentScrollHeight = 800

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
    // scrollHeight 未变化，delta = 0，不补偿
    restore()

    expect(_scrollTop).toBe(100)
  })

  it('内容缩短（负 delta）时不补偿 scrollTop', () => {
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
    // 内容缩短，scrollHeight 减小
    currentScrollHeight = 800
    restore()

    // delta = 800 - 1000 = -200 → 不满足 > 0，不补偿
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

  it('第一次调用时立即同步执行回调', () => {
    const fn = vi.fn()
    const throttled = rafThrottle(fn)
    throttled()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('参数能正确透传给回调函数', () => {
    const fn = vi.fn()
    const throttled = rafThrottle(fn)
    throttled('a', 'b')
    expect(fn).toHaveBeenCalledWith('a', 'b')
  })

  it('连续多次调用仅执行一次（节流行为）', () => {
    // 因为同步 rAF stub 导致 rafId 最终为 0（非 null），
    // 连续两次调用只执行一次。这正是节流的预期行为。
    const fn = vi.fn()
    const throttled = rafThrottle(fn)
    throttled()
    throttled() // rafId != null → suppressed
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

// ─── defaultGetItemKey：默认 key 生成函数 ───────────────────────────────────
// 直接使用数组索引作为虚拟条目的唯一 key

describe('defaultGetItemKey', () => {
  it('使用数组索引作为条目 key', () => {
    expect(defaultGetItemKey('anything', 3)).toBe(3)
    expect(defaultGetItemKey({ id: 'x' }, 0)).toBe(0)
  })
})
