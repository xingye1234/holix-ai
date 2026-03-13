import type { EventEnvelope } from './base'
import type { Chat } from '@/node/database/schema/chat'

export type CreateChatEnvelope = EventEnvelope<'chat.create', Chat>

export type ChatCreatedEnvelope = EventEnvelope<'chat.created', { chatUid: string }>

export type ChatUpdatedEnvelope = EventEnvelope<'chat.updated', { chatUid: string, updates: Record<string, any> }>

export type ChatDeletedEnvelope = EventEnvelope<'chat.deleted', { uid: string }>

export type ChatEnvelope = CreateChatEnvelope | ChatCreatedEnvelope | ChatUpdatedEnvelope | ChatDeletedEnvelope
