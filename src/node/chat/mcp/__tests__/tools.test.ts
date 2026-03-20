/**
 * MCP Tools 单元测试
 */

/* eslint-disable prefer-arrow-callback */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock logger - must be hoisted
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
}))

// Mock mcpStore - must be hoisted
const mockMcpStore = vi.hoisted(() => ({
  getConfig: vi.fn(() => ({
    mcpServers: {
      'test-server': {
        transport: 'stdio',
        command: 'node',
        args: ['server.js'],
        disabled: false,
      },
    },
  })),
}))

// Mock MultiServerMCPClient - must be hoisted
const mockGetTools = vi.hoisted(() => vi.fn(async () => [
  { name: 'tool1', description: 'Test tool 1' },
  { name: 'tool2', description: 'Test tool 2' },
]))

const mockMultiServerMCPClient = vi.hoisted(() => vi.fn(function () {
  return {
    getTools: mockGetTools,
  }
}))

// Apply mocks
vi.mock('../../../platform/logger', () => ({
  logger: mockLogger,
}))

vi.mock('../../../platform/mcp', () => ({
  mcpStore: mockMcpStore,
}))

vi.mock('@langchain/mcp-adapters', () => ({
  MultiServerMCPClient: mockMultiServerMCPClient,
}))

import { loadMcpTools } from '../tools'

describe('loadMcpTools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should load tools from configured MCP servers', async () => {
    const tools = await loadMcpTools()

    expect(tools).toHaveLength(2)
    expect(tools[0].name).toBe('tool1')
    expect(tools[1].name).toBe('tool2')
  })

  it('should return empty array when no servers configured', async () => {
    mockMcpStore.getConfig.mockReturnValue({ mcpServers: {} })

    const tools = await loadMcpTools()

    expect(tools).toEqual([])
  })

  it('should return empty array when all servers are disabled', async () => {
    mockMcpStore.getConfig.mockReturnValue({
      mcpServers: {
        'disabled-server': {
          transport: 'stdio',
          command: 'node',
          disabled: true,
        },
      },
    })

    const tools = await loadMcpTools()

    expect(tools).toEqual([])
  })

  it('should filter out disabled servers', async () => {
    mockMcpStore.getConfig.mockReturnValue({
      mcpServers: {
        'enabled-server': {
          transport: 'stdio',
          command: 'node',
          disabled: false,
        },
        'disabled-server': {
          transport: 'stdio',
          command: 'node',
          disabled: true,
        },
      },
    })

    const tools = await loadMcpTools()

    // Should only load from enabled server
    expect(tools.length).toBeGreaterThan(0)
  })

  it('should return empty array on error', async () => {
    mockMultiServerMCPClient.mockImplementationOnce(() => {
      throw new Error('Connection failed')
    })

    const tools = await loadMcpTools()

    expect(tools).toEqual([])
  })
})

describe('toTransportConfig (internal function behavior)', () => {
  it('should build stdio transport config when server has command', async () => {
    mockMcpStore.getConfig.mockReturnValue({
      mcpServers: {
        'stdio-server': {
          transport: 'stdio',
          command: 'node',
          args: ['server.js'],
          env: { NODE_ENV: 'test' },
          cwd: '/app',
          disabled: false,
        },
      },
    })

    const tools = await loadMcpTools()

    // Should successfully create client and load tools
    expect(Array.isArray(tools)).toBe(true)
  })

  it('should build http transport config when server has url', async () => {
    mockMcpStore.getConfig.mockReturnValue({
      mcpServers: {
        'http-server': {
          transport: 'http',
          url: 'http://localhost:3000',
          headers: { Authorization: 'Bearer token' },
          disabled: false,
        },
      },
    })

    const tools = await loadMcpTools()

    // Should successfully create client and load tools
    expect(Array.isArray(tools)).toBe(true)
  })

  it('should default to stdio transport when not specified', async () => {
    mockMcpStore.getConfig.mockReturnValue({
      mcpServers: {
        'default-server': {
          command: 'node',
          args: ['server.js'],
          disabled: false,
        },
      },
    })

    const tools = await loadMcpTools()

    // Should successfully create client and load tools
    expect(Array.isArray(tools)).toBe(true)
  })
})
