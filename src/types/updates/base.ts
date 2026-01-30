export interface EventEnvelope<
  N = string | symbol,
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  id: string
  timestamp: number
  type: 'update' | 'callback' | 'notification'
  name: N
  payload: T
}
