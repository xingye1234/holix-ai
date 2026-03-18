import type { CursorMcpConfig, CursorMcpServer } from '@/types/mcp'
import { logger } from '../../platform/logger'
import { mcpStore } from '../../platform/mcp'

interface MCPClientLike {
  getTools: () => Promise<any[]>
}

type MCPClientCtor = new (servers: Record<string, any>) => MCPClientLike

function toTransportConfig(server: CursorMcpServer) {
  const transport = server.transport || (server.url ? 'http' : 'stdio')

  if (transport === 'http') {
    if (!server.url) {
      throw new Error('Missing `url` for http transport')
    }
    return {
      transport,
      url: server.url,
      headers: server.headers,
    }
  }

  if (!server.command) {
    throw new Error('Missing `command` for stdio transport')
  }

  return {
    transport: 'stdio',
    command: server.command,
    args: server.args,
    env: server.env,
    cwd: server.cwd,
  }
}

function buildMcpClientConfig(config: CursorMcpConfig) {
  return Object.fromEntries(
    Object.entries(config.mcpServers)
      .filter(([, server]) => !server.disabled)
      .map(([name, server]) => [name, toTransportConfig(server)]),
  )
}

async function loadMcpClientCtor(): Promise<MCPClientCtor> {
  const mod = await import('@langchain/mcp-adapters')
  return mod.MultiServerMCPClient as MCPClientCtor
}

export async function loadMcpTools() {
  const config = mcpStore.getConfig()
  const servers = buildMcpClientConfig(config)

  if (Object.keys(servers).length === 0) {
    return []
  }

  try {
    const MultiServerMCPClient = await loadMcpClientCtor()
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
