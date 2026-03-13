/**
 * ToolCallTracker 单元测试
 */

import { describe, it, expect, vi } from 'vitest'
import { ToolCallTracker } from '../tool-call-tracker'
import type { DraftContent } from '../../../database/schema/chat'

// Mock logger to avoid Electron dependency
vi.mock('../../../platform/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('ToolCallTracker', () => {
  const tracker = new ToolCallTracker()

  describe('buildToolCallTraces', () => {
    it('should build traces from draft segments', () => {
      const draftSegments: DraftContent = [
        {
          id: 'seg-1',
          content: JSON.stringify({ name: 'search', args: { query: 'test' } }),
          phase: 'tool',
          source: 'model',
          createdAt: 1000,
          toolCallId: 'call-1',
          toolName: 'search',
          toolArgs: { query: 'test' },
        },
        {
          id: 'seg-2',
          content: 'Search result: found 10 items',
          phase: 'tool',
          source: 'tool',
          createdAt: 2000,
          toolCallId: 'call-1',
        },
      ]

      const traces = tracker.buildToolCallTraces(draftSegments)

      expect(traces).toHaveLength(1)
      expect(traces[0]).toMatchObject({
        toolCallId: 'call-1',
        toolName: 'search',
        toolArgs: { query: 'test' },
        status: 'completed',
        resultContent: 'Search result: found 10 items',
      })
    })

    it('should handle pending tool calls', () => {
      const draftSegments: DraftContent = [
        {
          id: 'seg-1',
          content: JSON.stringify({ name: 'search', args: { query: 'test' } }),
          phase: 'tool',
          source: 'model',
          createdAt: 1000,
          toolCallId: 'call-1',
          toolName: 'search',
          toolArgs: { query: 'test' },
        },
      ]

      const traces = tracker.buildToolCallTraces(draftSegments)

      expect(traces).toHaveLength(1)
      expect(traces[0].status).toBe('called')
      expect(traces[0].resultContent).toBeUndefined()
    })

    it('should handle multiple tool calls', () => {
      const draftSegments: DraftContent = [
        {
          id: 'seg-1',
          content: '',
          phase: 'tool',
          source: 'model',
          createdAt: 1000,
          toolCallId: 'call-1',
          toolName: 'tool1',
        },
        {
          id: 'seg-2',
          content: '',
          phase: 'tool',
          source: 'model',
          createdAt: 2000,
          toolCallId: 'call-2',
          toolName: 'tool2',
        },
        {
          id: 'seg-3',
          content: 'result1',
          phase: 'tool',
          source: 'tool',
          createdAt: 3000,
          toolCallId: 'call-1',
        },
      ]

      const traces = tracker.buildToolCallTraces(draftSegments)

      expect(traces).toHaveLength(2)
      expect(traces[0].status).toBe('completed')
      expect(traces[1].status).toBe('called')
    })
  })

  describe('getToolCallStats', () => {
    it('should calculate statistics', () => {
      const traces = [
        {
          id: '1',
          toolName: 'search',
          status: 'completed',
          requestContent: '',
          createdAt: 1000,
          updatedAt: 2000,
        },
        {
          id: '2',
          toolName: 'search',
          status: 'completed',
          requestContent: '',
          createdAt: 3000,
          updatedAt: 4000,
        },
        {
          id: '3',
          toolName: 'calculate',
          status: 'called',
          requestContent: '',
          createdAt: 5000,
          updatedAt: 5000,
        },
      ] as any

      const stats = tracker.getToolCallStats(traces)

      expect(stats.total).toBe(3)
      expect(stats.completed).toBe(2)
      expect(stats.pending).toBe(1)
      expect(stats.byTool).toEqual({
        search: 2,
        calculate: 1,
      })
    })
  })

  describe('hasPendingToolCalls', () => {
    it('should return true if there are pending calls', () => {
      const traces = [
        { status: 'completed' },
        { status: 'called' },
      ] as any

      expect(tracker.hasPendingToolCalls(traces)).toBe(true)
    })

    it('should return false if all calls are completed', () => {
      const traces = [
        { status: 'completed' },
        { status: 'completed' },
      ] as any

      expect(tracker.hasPendingToolCalls(traces)).toBe(false)
    })
  })

  describe('getLastToolCall', () => {
    it('should return the last tool call', () => {
      const traces = [
        { id: '1', toolName: 'tool1' },
        { id: '2', toolName: 'tool2' },
        { id: '3', toolName: 'tool3' },
      ] as any

      const last = tracker.getLastToolCall(traces)

      expect(last?.id).toBe('3')
      expect(last?.toolName).toBe('tool3')
    })

    it('should return undefined for empty array', () => {
      const traces: any[] = []
      const last = tracker.getLastToolCall(traces)
      expect(last).toBeUndefined()
    })
  })
})
