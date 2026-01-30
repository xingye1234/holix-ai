import { net } from 'electron'
import { tool } from 'langchain'
import * as z from 'zod'

const CONTEXT7_BASE = 'https://context7.com/api/v2'

export function createContext7Tool(apiKey: string) {
  if (!apiKey) {
    throw new Error('Context7 API key is required to create the Context7 tool.')
  }

  return tool(
    async ({ query, libraryName, limit }) => {
    // 1. Search libraries
      const searchUrl = new URL(`${CONTEXT7_BASE}/libs/search`)
      searchUrl.searchParams.set('query', query)
      searchUrl.searchParams.set('libraryName', libraryName)

      const API_KEY = apiKey

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

      // 2. Fetch context snippets
      const ctxUrl = new URL(`${CONTEXT7_BASE}/context`)
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
    },
    {
      name: 'context7_search',
      description: 'Search the Context7 official documentation API and return up-to-date context snippets.',
      schema: z.object({
        query: z
          .string()
          .describe('Search query or natural language question'),
        libraryName: z
          .string()
          .describe('Target library or framework name, e.g. react, vue, next.js'),
        limit: z
          .number()
          .optional()
          .default(5)
          .describe('Maximum number of context snippets to return'),
      }),
    },
  )
}
