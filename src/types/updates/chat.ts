import type { EventEnvelope } from './base'
import type { Chat } from '@/node/database/schema/chat'

export type CreateChatEnvelope = EventEnvelope<'chat.create', Chat>

export type ChatUpdatedEnvelope = EventEnvelope<'chat.updated', Chat>

export type ChatDeletedEnvelope = EventEnvelope<'chat.deleted', { uid: string }>

export type ChatEnvelope = CreateChatEnvelope | ChatUpdatedEnvelope | ChatDeletedEnvelope
