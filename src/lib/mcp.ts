import type { CursorMcpConfig } from '@/types/mcp'
import { kyInstance } from './ky'

export async function getMcpConfig() {
  return await kyInstance.get('mcp').json<CursorMcpConfig>()
}

export async function updateMcpConfig(config: CursorMcpConfig) {
  return await kyInstance.put('mcp', { json: config }).json<CursorMcpConfig>()
}
