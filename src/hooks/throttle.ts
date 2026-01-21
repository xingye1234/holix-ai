import { useCallback, useRef } from 'react'

export function useRafThrottle<T extends (...args: any[]) => void>(fn: T, deps?: React.DependencyList): T {
  const rafId = useRef<number | null>(null)
  const lastArgs = useRef<any[]>([])

  return useCallback(((...args: any[]) => {
    lastArgs.current = args

    if (rafId.current !== null)
      return

    rafId.current = requestAnimationFrame(() => {
      rafId.current = null
      fn(...lastArgs.current)
    })
  }) as T, [fn, ...(deps || [])])
}
