import type { HandlerFor } from '@/lib/command'
import type { UpdateNames } from '@/types/updates'
import { useEffect } from 'react'
import { onUpdate } from '@/lib/command'

/**
 * Subscribe to a named update event.
 *
 * The callback `fn` is strongly typed based on the provided `name`.
 * You can pass an optional `deps` list to control when the subscription is re-created.
 */
export default function useUpdate<N extends UpdateNames>(
  name: N,
  fn: HandlerFor<N>,
) {
  useEffect(
    () => {
      const unsubscribe = onUpdate<N>(name, fn)
      return unsubscribe
    },
    [name, fn],
  )
}
