import type { AutoUpdateEnvelope } from './auto-update'
import type { ChatEnvelope } from './chat'
import type { MainLogEnvelope } from './main-log'
import type { ChatUpdateEnvelope } from './message'
import type { WindowUpdateEnvelope } from './system'

export type Update = ChatEnvelope | WindowUpdateEnvelope | ChatUpdateEnvelope | AutoUpdateEnvelope | MainLogEnvelope

export type UpdateNames = Update['name']
