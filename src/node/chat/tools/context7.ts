import type { ChatContext } from '../context'
import { net } from 'electron'
import { tool } from 'langchain'
import * as z from 'zod'

const CONTEXT7_BASE = 'https://context7.com/api/v2'

export const context7Tool = tool(
  async ({ query, libraryName, limit = 5 }, config: { context: ChatContext }) => {
    const API_KEY = config.context.config.context7ApiKey

    if (!API_KEY) {
      throw new Error('Context7 API key is not configured.')
    }

    // 1) Search libraries (GET /libs/search?libraryName=...&query=...)
    const searchUrl = new URL(`${CONTEXT7_BASE}/libs/search`)
    if (query)
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

    const searchJson = await searchResp.json()
    const libraries = Array.isArray(searchJson.results) ? searchJson.results : (Array.isArray(searchJson) ? searchJson : [])

    if (!libraries.length) {
      return { query, library: null, context: [] }
    }

    const library = libraries[0]

    // 2) Fetch context snippets (GET /context?libraryId=...&query=...&limit=...)
    const ctxUrl = new URL(`${CONTEXT7_BASE}/context`)
    if (query)
      ctxUrl.searchParams.set('query', query)
    ctxUrl.searchParams.set('libraryId', library.id ?? library)
    ctxUrl.searchParams.set('limit', String(limit))

    const ctxResp = await net.fetch(ctxUrl.toString(), {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
    })

    if (!ctxResp.ok) {
      throw new Error(`Context7 context fetch failed: ${await ctxResp.text()}`)
    }

    const ctxJson = await ctxResp.json()
    const context = Array.isArray(ctxJson.results) ? ctxJson.results : (Array.isArray(ctxJson) ? ctxJson : [])

    return {
      query,
      library,
      context,
    }
  },
  {
    name: 'context7_search',
    description: 'Search the Context7 API and return up-to-date context snippets.',
    schema: z.object({
      query: z.string().describe('Search query or natural language question'),
      libraryName: z.string().optional().describe('Target library or framework name, e.g. react, vue, next.js'),
      limit: z.number().optional().default(5).describe('Maximum number of context snippets to return'),
    }),
  },
)
