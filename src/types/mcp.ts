export interface CursorMcpServer {
  command?: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  url?: string
  headers?: Record<string, string>
  transport?: 'stdio' | 'http'
  disabled?: boolean
}

export interface CursorMcpConfig {
  mcpServers: Record<string, CursorMcpServer>
}
