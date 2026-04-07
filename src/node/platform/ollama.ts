const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434'
const REQUEST_TIMEOUT_MS = 5000

export interface OllamaSettings {
  enabled: boolean
  host: string
  port: string
  apiKey: string
  models: string[]
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

export function buildOllamaBaseUrl(host?: string, port?: string) {
  const normalizedHost = host?.trim() || 'localhost'
  const normalizedPort = port?.trim() || '11434'

  try {
    if (/^https?:\/\//i.test(normalizedHost)) {
      const url = new URL(normalizedHost)
      if (normalizedPort) {
        url.port = normalizedPort
      }
      return normalizeOllamaBaseUrl(url.toString())
    }
  }
  catch {}

  return normalizeOllamaBaseUrl(`http://${normalizedHost}:${normalizedPort}`)
}

export function buildOllamaHeaders(apiKey?: string) {
  const token = apiKey?.trim()
  if (!token) {
    return undefined
  }

  return {
    Authorization: `Bearer ${token}`,
  }
}

export function normalizeOllamaBaseUrl(baseUrl?: string) {
  const fallback = trimTrailingSlash(DEFAULT_OLLAMA_BASE_URL)
  const input = baseUrl?.trim()

  if (!input) {
    return fallback
  }

  try {
    const url = new URL(input)
    url.pathname = url.pathname.replace(/\/+$/, '')

    if (url.pathname === '/v1') {
      url.pathname = ''
    }

    return trimTrailingSlash(url.toString())
  }
  catch {
    return trimTrailingSlash(input).replace(/\/v1$/, '')
  }
}

function dedupeModels(models: string[]) {
  const seen = new Set<string>()
  const next: string[] = []

  for (const model of models) {
    const trimmed = model.trim()
    if (!trimmed || seen.has(trimmed)) {
      continue
    }
    seen.add(trimmed)
    next.push(trimmed)
  }

  return next
}

async function fetchJsonWithTimeout(input: string, init?: RequestInit) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(body || `Request failed with status ${response.status}`)
    }

    return await response.json()
  }
  finally {
    clearTimeout(timeout)
  }
}

export async function discoverOllamaModels(baseUrl?: string, apiKey?: string) {
  const normalizedBaseUrl = normalizeOllamaBaseUrl(baseUrl)
  const headers = buildOllamaHeaders(apiKey)
  const errors: Error[] = []

  try {
    const payload = await fetchJsonWithTimeout(`${normalizedBaseUrl}/api/tags`, { headers })
    const models = dedupeModels(
      Array.isArray(payload?.models)
        ? payload.models.flatMap((model: { name?: string, model?: string }) => [model.name, model.model].filter(Boolean) as string[])
        : [],
    )

    if (models.length > 0) {
      return {
        models,
        normalizedBaseUrl,
      }
    }
  }
  catch (error) {
    errors.push(error instanceof Error ? error : new Error(String(error)))
  }

  try {
    const payload = await fetchJsonWithTimeout(`${normalizedBaseUrl}/v1/models`, { headers })
    const models = dedupeModels(
      Array.isArray(payload?.data)
        ? payload.data.map((model: { id?: string }) => model.id || '').filter(Boolean)
        : [],
    )

    if (models.length > 0) {
      return {
        models,
        normalizedBaseUrl,
      }
    }
  }
  catch (error) {
    errors.push(error instanceof Error ? error : new Error(String(error)))
  }

  throw new Error(errors[0]?.message || 'Failed to discover Ollama models')
}
