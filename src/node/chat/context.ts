import type { ConfigData } from '../platform/config'
import z from 'zod'

export const contextSchema = z.object({
  config: z.custom<ConfigData>(),
})

export type ChatContext = z.infer<typeof contextSchema>
