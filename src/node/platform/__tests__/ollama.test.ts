import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildOllamaBaseUrl, buildOllamaHeaders, discoverOllamaModels, normalizeOllamaBaseUrl } from '../ollama'

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('normalizeOllamaBaseUrl', () => {
  it('should strip /v1 suffix from configured urls', () => {
    expect(normalizeOllamaBaseUrl('http://localhost:11434/v1')).toBe('http://localhost:11434')
    expect(normalizeOllamaBaseUrl('http://localhost:11434/v1/')).toBe('http://localhost:11434')
  })

  it('should fall back to default localhost endpoint', () => {
    expect(normalizeOllamaBaseUrl()).toBe('http://localhost:11434')
  })
})

describe('buildOllamaBaseUrl', () => {
  it('should build a local ollama url from host and port', () => {
    expect(buildOllamaBaseUrl('localhost', '11434')).toBe('http://localhost:11434')
  })
})

describe('buildOllamaHeaders', () => {
  it('should return bearer authorization when api key is provided', () => {
    expect(buildOllamaHeaders('secret-token')).toEqual({
      Authorization: 'Bearer secret-token',
    })
  })
})

describe('discoverOllamaModels', () => {
  it('should parse models from /api/tags first', async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({
        models: [
          { name: 'qwen2.5:7b' },
          { name: 'llama3.2:3b' },
          { model: 'llama3.2:3b' },
        ],
      })) as any)

    await expect(discoverOllamaModels('http://localhost:11434/v1')).resolves.toEqual({
      models: ['qwen2.5:7b', 'llama3.2:3b'],
      normalizedBaseUrl: 'http://localhost:11434',
    })
  })

  it('should pass authorization header when api key is provided', async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({
        models: [{ name: 'qwen2.5:7b' }],
      })) as any)

    await discoverOllamaModels('http://localhost:11434', 'secret-token')

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/tags',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer secret-token',
        },
      }),
    )
  })

  it('should fall back to /v1/models when /api/tags is unavailable', async () => {
    global.fetch = vi
      .fn()
      .mockImplementationOnce(async () => new Response('not found', { status: 404 }))
      .mockImplementationOnce(async () =>
        new Response(JSON.stringify({
          data: [
            { id: 'deepseek-r1:8b' },
            { id: 'qwen3:32b' },
          ],
        })) as any)

    await expect(discoverOllamaModels('http://localhost:11434')).resolves.toEqual({
      models: ['deepseek-r1:8b', 'qwen3:32b'],
      normalizedBaseUrl: 'http://localhost:11434',
    })
  })
})
