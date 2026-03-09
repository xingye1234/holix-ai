'use strict'

const https = require('node:https')
const { URL } = require('node:url')

const DEFAULT_SEARCH_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/web_search'
const DEFAULT_BROWSER_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/web_browser'

function toJsonSafe(value) {
  try {
    return JSON.stringify(value, null, 2)
  }
  catch {
    return String(value)
  }
}

function requestJson(endpoint, token, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint)
    const body = JSON.stringify(payload)

    const req = https.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 30_000,
    }, (res) => {
      const chunks = []

      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf-8')
        const statusCode = res.statusCode ?? 0

        if (statusCode < 200 || statusCode >= 300) {
          reject(new Error(`HTTP ${statusCode}: ${text || 'empty response'}`))
          return
        }

        try {
          resolve(JSON.parse(text))
        }
        catch {
          reject(new Error(`Invalid JSON response: ${text}`))
        }
      })
    })

    req.on('timeout', () => req.destroy(new Error('Request timeout')))
    req.on('error', err => reject(err))
    req.write(body)
    req.end()
  })
}

function getConfig(context) {
  const cfg = context?.skillConfig ?? {}
  const apiToken = typeof cfg.apiToken === 'string' ? cfg.apiToken.trim() : ''
  const searchEndpoint = typeof cfg.searchEndpoint === 'string' && cfg.searchEndpoint.trim()
    ? cfg.searchEndpoint.trim()
    : DEFAULT_SEARCH_ENDPOINT
  const browserEndpoint = typeof cfg.browserEndpoint === 'string' && cfg.browserEndpoint.trim()
    ? cfg.browserEndpoint.trim()
    : DEFAULT_BROWSER_ENDPOINT
  const defaultEngine = typeof cfg.defaultEngine === 'string' && cfg.defaultEngine.trim()
    ? cfg.defaultEngine.trim()
    : 'search_std'

  return { apiToken, searchEndpoint, browserEndpoint, defaultEngine }
}

function buildCommonPayload(args, defaultCount) {
  const count = Number.isFinite(args.count) ? Math.max(1, Math.min(50, Math.floor(args.count))) : defaultCount

  const payload = {
    count,
    search_recency_filter: args.search_recency_filter || 'noLimit',
    content_size: args.content_size || 'medium',
  }

  if (args.request_id)
    payload.request_id = args.request_id
  if (args.user_id)
    payload.user_id = args.user_id

  return payload
}

const webSearch = {
  name: 'web_search',
  execute: async (args, context) => {
    const { apiToken, searchEndpoint, defaultEngine } = getConfig(context)

    if (!apiToken)
      return 'web_search skill 未配置 apiToken。请在 Settings > Skills > web_search 中填写 BigModel API Token。'

    const payload = {
      ...buildCommonPayload(args, 10),
      search_query: args.search_query,
      search_engine: args.search_engine || defaultEngine,
      search_intent: typeof args.search_intent === 'boolean' ? args.search_intent : false,
    }

    if (args.search_domain_filter)
      payload.search_domain_filter = args.search_domain_filter

    const result = await requestJson(searchEndpoint, apiToken, payload)

    return [
      `tool: web_search`,
      `query: ${args.search_query}`,
      `endpoint: ${searchEndpoint}`,
      '',
      toJsonSafe(result),
    ].join('\n')
  },
}

const webBrowser = {
  name: 'web_browser',
  execute: async (args, context) => {
    const { apiToken, browserEndpoint } = getConfig(context)

    if (!apiToken)
      return 'web_search skill 未配置 apiToken。请在 Settings > Skills > web_search 中填写 BigModel API Token。'

    const payload = {
      ...buildCommonPayload(args, 3),
      url: args.url,
    }

    const result = await requestJson(browserEndpoint, apiToken, payload)

    return [
      `tool: web_browser`,
      `url: ${args.url}`,
      `endpoint: ${browserEndpoint}`,
      '',
      toJsonSafe(result),
    ].join('\n')
  },
}

module.exports = [webSearch, webBrowser]
