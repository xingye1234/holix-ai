import type { ChatContext } from '../context'
import { net } from 'electron'
import { tool } from 'langchain'
import * as z from 'zod'
import { logger } from '../../platform/logger'

const CONTEXT7_BASE = 'https://context7.com/api/v1'

type JsonRecord = Record<string, any>

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
}

async function parseJson(resp: Response): Promise<any> {
  const text = await resp.text()
  try {
    return JSON.parse(text)
  }
  catch {
    return text
  }
}

function normalizeLibraries(payload: any): any[] {
  if (Array.isArray(payload))
    return payload

  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.results))
      return payload.results

    if (Array.isArray(payload.libraries))
      return payload.libraries

    if (Array.isArray(payload.data))
      return payload.data
  }

  return []
}

function normalizeContext(payload: any): any[] {
  if (Array.isArray(payload))
    return payload

  if (payload && typeof payload === 'object') {
    const knownArrayFields = ['results', 'context', 'snippets', 'documents', 'docs', 'data']

    for (const key of knownArrayFields) {
      if (Array.isArray(payload[key]))
        return payload[key]
    }

    if (typeof payload.content === 'string')
      return [{ content: payload.content }]
  }

  if (typeof payload === 'string')
    return [{ content: payload }]

  return []
}

function extractLibraryId(library: any): string | undefined {
  if (!library)
    return undefined

  if (typeof library === 'string')
    return library

  return library.id ?? library.libraryId ?? library.context7CompatibleLibraryID
}

export const context7Tool = tool(
  async ({ query, libraryName, limit = 5 }, config: { context: ChatContext }) => {
    const API_KEY = config.context.config.context7ApiKey

    logger.info('Using Context7 tool', { query, libraryName, limit })

    if (!API_KEY) {
      logger.error('Context7 API key is not configured.')
      throw new Error('Context7 API key is not configured.')
    }

    // 1) Resolve library by latest API (POST /resolve-library-id)
    const resolveResp = await net.fetch(`${CONTEXT7_BASE}/resolve-library-id`, {
      method: 'POST',
      headers: buildHeaders(API_KEY),
      body: JSON.stringify({
        libraryName,
        query,
      } satisfies JsonRecord),
    })

    if (!resolveResp.ok) {
      throw new Error(`Context7 resolve library failed: ${await resolveResp.text()}`)
    }

    const resolveJson = await parseJson(resolveResp)
    const libraries = normalizeLibraries(resolveJson)

    if (!libraries.length) {
      return { query, library: null, context: [] }
    }

    const library = libraries[0]
    const libraryId = extractLibraryId(library)

    if (!libraryId) {
      logger.error('Context7 resolve response missing library id', { resolveJson })
      throw new Error('Context7 resolve response missing library id')
    }

    // 2) Fetch docs/context by latest API (POST /get-library-docs)
    const docsResp = await net.fetch(`${CONTEXT7_BASE}/get-library-docs`, {
      method: 'POST',
      headers: buildHeaders(API_KEY),
      body: JSON.stringify({
        context7CompatibleLibraryID: libraryId,
        topic: query,
        limit,
      } satisfies JsonRecord),
    })

    if (!docsResp.ok) {
      logger.error('Context7 docs fetch failed', { status: docsResp.status, statusText: docsResp.statusText })
      throw new Error(`Context7 docs fetch failed: ${await docsResp.text()}`)
    }

    const docsJson = await parseJson(docsResp)
    const context = normalizeContext(docsJson)

    logger.info('Context7 tool fetched context snippets', { count: context.length })

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
