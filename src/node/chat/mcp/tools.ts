import type { CursorMcpConfig, CursorMcpServer } from '@/types/mcp'
import type { Connection } from '@langchain/mcp-adapters'
import { MultiServerMCPClient } from '@langchain/mcp-adapters'
import { logger } from '../../platform/logger'
import { mcpStore } from '../../platform/mcp'

function toTransportConfig(server: CursorMcpServer): Connection {
  const transport = server.transport || (server.url ? 'http' : 'stdio')

  if (transport === 'http') {
    if (!server.url) {
      throw new Error('Missing `url` for http transport')
    }
    return {
      url: server.url,
      headers: server.headers,
    } as Connection
  }

  if (!server.command) {
    throw new Error('Missing `command` for stdio transport')
  }

  return {
    command: server.command,
    args: server.args ?? [],
    env: server.env,
    cwd: server.cwd,
  } as Connection
}

function buildMcpClientConfig(config: CursorMcpConfig): Record<string, Connection> {
  return Object.fromEntries(
    Object.entries(config.mcpServers)
      .filter(([, server]) => !server.disabled)
      .map(([name, server]) => [name, toTransportConfig(server)]),
  ) as Record<string, Connection>
}

export async function loadMcpTools() {
  const config = mcpStore.getConfig()
  const servers = buildMcpClientConfig(config)

  if (Object.keys(servers).length === 0) {
    return []
  }

  try {
    // MultiServerMCPClient accepts Record<string, Connection> directly
    const client = new MultiServerMCPClient(servers)
    const tools = await client.getTools()
    logger.info(`[MCP] Loaded ${tools.length} MCP tools from ${Object.keys(servers).length} servers`)
    return tools
  }
  catch (error) {
    logger.error('[MCP] Failed to initialize MCP tools:', error)
    return []
  }
}
