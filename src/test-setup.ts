/**
 * @fileoverview Global test setup for UI (happy-dom) tests
 *
 * Loaded via vitest setupFiles for the 'ui' project.
 */

import '@testing-library/jest-dom'

// ── ResizeObserver ────────────────────────────────────────────────────────────
// happy-dom does not implement ResizeObserver; @tanstack/react-virtual needs it.

class MockResizeObserver {
  private callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  observe(target: Element) {
    // Immediately fire with a zero-size entry so the virtualizer initialises.
    this.callback(
      [{ target, contentRect: target.getBoundingClientRect() } as ResizeObserverEntry],
      this,
    )
  }

  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', MockResizeObserver)

// ── requestAnimationFrame / cancelAnimationFrame ──────────────────────────────
// happy-dom stubs exist but may not flush synchronously in all cases.
// Use a mock that doesn't cause infinite recursion with framer-motion's infinite animations
// but still allows normal RAF callbacks (like rafThrottle) to execute.

let rafId = 0
let rafDepth = 0
const MAX_RAF_DEPTH = 50 // Prevent infinite recursion from framer-motion

vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
  const id = ++rafId

  // Execute synchronously but with recursion depth limit
  if (rafDepth < MAX_RAF_DEPTH) {
    rafDepth++
    try {
      cb(performance.now())
    }
    finally {
      rafDepth--
    }
  }
  // If depth exceeded, silently skip to prevent stack overflow

  return id
})

vi.stubGlobal('cancelAnimationFrame', () => {})

// ── scrollTo / scroll ─────────────────────────────────────────────────────────
// happy-dom does not implement Element.scrollTo; prevent "not a function" errors.

if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function (optionsOrX?: ScrollToOptions | number, y?: number) {
    if (typeof optionsOrX === 'object' && optionsOrX !== null) {
      if (optionsOrX.top !== undefined)
        (this as HTMLElement).scrollTop = optionsOrX.top
      if (optionsOrX.left !== undefined)
        (this as HTMLElement).scrollLeft = optionsOrX.left
    }
    else if (typeof optionsOrX === 'number') {
      ;(this as HTMLElement).scrollLeft = optionsOrX
      if (y !== undefined)
        (this as HTMLElement).scrollTop = y
    }
  }
}
