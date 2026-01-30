export interface Command<N = string, P extends Record<string, unknown> = Record<string, unknown>> {
  id: string
  name: N
  timestamp: number
  payload: P
}
