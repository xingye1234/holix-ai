import { net } from 'electron'
import { tool } from 'langchain'
import * as z from 'zod'

const CONTEXT7_BASE = 'https://context7.com/api'

function buildAuthHeaders(apiKey: string) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
}

export function createContext7Tool(apiKey: string) {
  if (!apiKey) {
    throw new Error('Context7 API key is required to create the Context7 tool.')
  }

  return tool(
    async ({ query, libraryName, limit = 5 }) => {
      const API_KEY = apiKey

      // 尝试新版 MCP endpoints（resolve-library-id + query-docs）
      try {
        // 1) resolve library id
        const resolveUrl = new URL(`${CONTEXT7_BASE}/mcp/resolve-library-id`)
        const resolveResp = await net.fetch(resolveUrl.toString(), {
          method: 'POST',
          headers: buildAuthHeaders(API_KEY),
          body: JSON.stringify({ query, libraryName }),
        })

        if (resolveResp.ok) {
          const resolved = await resolveResp.json()
          const library = resolved?.library ?? resolved?.libraryId ?? null

          // 2) query docs using library id
          if (library) {
            const queryUrl = new URL(`${CONTEXT7_BASE}/mcp/query-docs`)
            const queryResp = await net.fetch(queryUrl.toString(), {
              method: 'POST',
              headers: buildAuthHeaders(API_KEY),
              body: JSON.stringify({ libraryId: library.id ?? library, query, limit }),
            })

            if (queryResp.ok) {
              const context = await queryResp.json()
              return { query, library, context }
            }
          }
        }
      }
      catch (e) {
        // 如果新版 MCP 请求失败，继续尝试兼容旧 API
        // console.warn('Context7 MCP endpoints failed, falling back to legacy API', e)
      }

      // 回退到旧版兼容接口（保持向后兼容）
      try {
        const searchUrl = new URL(`${CONTEXT7_BASE}/v2/libs/search`)
        searchUrl.searchParams.set('query', query)
        if (libraryName)
          searchUrl.searchParams.set('libraryName', libraryName)

        const searchResp = await net.fetch(searchUrl.toString(), {
          headers: {
            Authorization: `Bearer ${API_KEY}`,
          },
        })

        if (!searchResp.ok) {
          throw new Error(`Context7 library search failed: ${await searchResp.text()}`)
        }

        const libraries = await searchResp.json()
        if (!libraries?.length) {
          return { query, library: null, context: [] }
        }

        const library = libraries[0]

        const ctxUrl = new URL(`${CONTEXT7_BASE}/v2/context`)
        ctxUrl.searchParams.set('query', query)
        ctxUrl.searchParams.set('libraryId', library.id)
        ctxUrl.searchParams.set('limit', String(limit))

        const ctxResp = await net.fetch(ctxUrl.toString(), {
          headers: {
            Authorization: `Bearer ${API_KEY}`,
          },
        })

        if (!ctxResp.ok) {
          throw new Error(`Context7 context fetch failed: ${await ctxResp.text()}`)
        }

        const context = await ctxResp.json()

        return {
          query,
          library,
          context,
        }
      }
      catch (err: any) {
        throw new Error(`Context7 request failed: ${err?.message ?? String(err)}`)
      }
    },
    {
      name: 'context7_search',
      description: 'Search Context7 and return up-to-date documentation snippets (supports MCP / legacy APIs).',
      schema: z.object({
        query: z.string().describe('Search query or natural language question'),
        libraryName: z.string().optional().describe('Target library or framework name, e.g. react, vue, next.js'),
        limit: z.number().optional().default(5).describe('Maximum number of context snippets to return'),
      }),
    },
  )
}
