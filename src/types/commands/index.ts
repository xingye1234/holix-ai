import type { ChatCommands } from './chat'
import type { SendMessage } from './message'

export type Commands = ChatCommands | SendMessage

export type CommandBatch = Commands[]

export type CommandNames = Commands['name']
