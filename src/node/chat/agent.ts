import type { BaseChatModel, BaseChatModelCallOptions } from '@langchain/core/language_models/chat_models'
import type { MessageStructure, MessageToolSet } from '@langchain/core/messages'
import type { AIMessageChunk } from 'langchain'
import { createAgent as langchainCreateAgent } from 'langchain'

export function createAgent(llm: BaseChatModel<BaseChatModelCallOptions, AIMessageChunk<MessageStructure<MessageToolSet>>>) {
  return langchainCreateAgent({
    model: llm,
  })
}
