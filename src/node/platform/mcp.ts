import type { HolixProtocolRouter } from '@holix/router'
import type { CursorMcpConfig } from '@/types/mcp'
import { Store } from './store'

export class McpStore extends Store<CursorMcpConfig> {
  constructor() {
    super({
      name: 'mcp',
      defaultData: {
        mcpServers: {},
      },
      basePath: 'mcp',
    })
  }

  getConfig(): CursorMcpConfig {
    return this.getData()
  }

  async setConfig(config: CursorMcpConfig) {
    this.getStore().data = config
    await this.saveStore()
    return config
  }

  use(router: HolixProtocolRouter) {
    const basePath = `/${this.basePath || this.name}`

    router.get(basePath, async (ctx) => {
      ctx.json(this.getConfig())
    })

    router.put(basePath, async (ctx) => {
      const body = await ctx.req.json() as CursorMcpConfig
      if (!body || typeof body !== 'object' || !body.mcpServers || typeof body.mcpServers !== 'object') {
        return ctx.status(400).json({ error: 'Invalid MCP config: mcpServers object is required' })
      }
      const saved = await this.setConfig(body)
      ctx.json(saved)
    })
  }
}

export const mcpStore = new McpStore()
