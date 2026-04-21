import type { LlmConfig } from '../types'
import { createKimiProvider, isKimiProvider } from './kimi'

export function createCustomProviderModel(model: string, config?: LlmConfig) {
  if (isKimiProvider(config)) {
    return createKimiProvider(model, config)
  }

  return null
}

export { createKimiProvider, isKimiProvider, KimiChatModel } from './kimi'
