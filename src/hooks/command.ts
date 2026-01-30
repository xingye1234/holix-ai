import type { CommandNames } from '@/types/commands'
import { useCallback, useEffect } from 'react'
import { command, registerCommandHandler } from '@/lib/command'

export default function useCommand<N extends CommandNames>(name: N) {
  return useCallback(
    <D extends Record<string, unknown>>(
      preload: D,
    ) => {
      command(name, preload)
    },
    [name],
  )
}

export function useHandler(name: string, fn: (...args: any[]) => Promise<any>) {
  useEffect(() => {
    const unregister = registerCommandHandler(name, fn)
    return () => {
      unregister()
    }
  }, [name, fn])
}
