import z from 'zod'
import { id } from 'zod/v4/locales'

export const actionToClientRequest = z.object({
  id: z.string(),
  type: z.enum(['callback', 'notification']),
  args: z.array(z.unknown()),
  name: z.string(),
})

export type ActionToClientRequest = z.infer<typeof actionToClientRequest>
