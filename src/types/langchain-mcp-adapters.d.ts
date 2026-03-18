declare module '@langchain/mcp-adapters' {
  export class MultiServerMCPClient {
    constructor(servers: Record<string, any>)
    getTools(): Promise<any[]>
  }
}
