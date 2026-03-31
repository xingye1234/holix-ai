/**
 * Session State 类型单元测试
 */

import { describe, expect, it } from 'vitest'
import type { SessionConfig, SessionState, SessionStatus } from '../session-state'

describe('SessionState Types', () => {
  describe('SessionStatus', () => {
    it('should accept valid session status values', () => {
      const statuses: SessionStatus[] = ['running', 'completed', 'aborted', 'error']

      statuses.forEach((status) => {
        expect(typeof status).toBe('string')
      })
    })
  })

  describe('SessionConfig', () => {
    it('should accept valid session config', () => {
      const modelConfig = {
        provider: 'openai',
        model: 'gpt-4.1',
        apiKey: 'sk-test',
        baseURL: 'https://api.openai.com/v1',
      }
      const mockSystemMessage = { content: 'System prompt' } as any
      const mockWorkspace = [{ type: 'directory', value: '/path' }]

      const config: SessionConfig = {
        chatUid: 'chat-123',
        requestId: 'req-456',
        streamId: 'stream-789',
        assistantMessageUid: 'msg-abc',
        modelConfig,
        systemMessages: [mockSystemMessage],
        workspace: mockWorkspace as any,
      }

      expect(config.chatUid).toBe('chat-123')
      expect(config.requestId).toBe('req-456')
      expect(config.streamId).toBe('stream-789')
      expect(config.assistantMessageUid).toBe('msg-abc')
      expect(config.modelConfig).toBe(modelConfig)
      expect(config.systemMessages).toEqual([mockSystemMessage])
      expect(config.workspace).toEqual(mockWorkspace)
    })

    it('should accept session config without optional fields', () => {
      const modelConfig = {
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
      }

      const config: SessionConfig = {
        chatUid: 'chat-123',
        requestId: 'req-456',
        streamId: 'stream-789',
        assistantMessageUid: 'msg-abc',
        modelConfig,
      }

      expect(config.systemMessages).toBeUndefined()
      expect(config.workspace).toBeUndefined()
    })
  })

  describe('SessionState', () => {
    it('should accept valid session state', () => {
      const modelConfig = {
        provider: 'openai',
        model: 'gpt-4.1',
      }
      const mockAbortController = new AbortController()

      const config: SessionConfig = {
        chatUid: 'chat-123',
        requestId: 'req-456',
        streamId: 'stream-789',
        assistantMessageUid: 'msg-abc',
        modelConfig,
      }

      const state: SessionState = {
        config,
        status: 'running',
        abortController: mockAbortController,
        startTime: Date.now(),
      }

      expect(state.config).toBe(config)
      expect(state.status).toBe('running')
      expect(state.abortController).toBe(mockAbortController)
      expect(typeof state.startTime).toBe('number')
      expect(state.endTime).toBeUndefined()
      expect(state.error).toBeUndefined()
    })

    it('should accept session state with endTime', () => {
      const modelConfig = {
        provider: 'openai',
        model: 'gpt-4.1',
      }
      const mockAbortController = new AbortController()
      const startTime = Date.now() - 1000
      const endTime = Date.now()

      const config: SessionConfig = {
        chatUid: 'chat-123',
        requestId: 'req-456',
        streamId: 'stream-789',
        assistantMessageUid: 'msg-abc',
        modelConfig,
      }

      const state: SessionState = {
        config,
        status: 'completed',
        abortController: mockAbortController,
        startTime,
        endTime,
      }

      expect(state.endTime).toBe(endTime)
      expect(state.endTime).toBeGreaterThan(startTime)
    })

    it('should accept session state with error', () => {
      const modelConfig = {
        provider: 'openai',
        model: 'gpt-4.1',
      }
      const mockAbortController = new AbortController()

      const config: SessionConfig = {
        chatUid: 'chat-123',
        requestId: 'req-456',
        streamId: 'stream-789',
        assistantMessageUid: 'msg-abc',
        modelConfig,
      }

      const state: SessionState = {
        config,
        status: 'error',
        abortController: mockAbortController,
        startTime: Date.now(),
        error: 'Something went wrong',
      }

      expect(state.error).toBe('Something went wrong')
      expect(state.status).toBe('error')
    })

    it('should accept all possible status values', () => {
      const modelConfig = {
        provider: 'openai',
        model: 'gpt-4.1',
      }
      const mockAbortController = new AbortController()

      const config: SessionConfig = {
        chatUid: 'chat-123',
        requestId: 'req-456',
        streamId: 'stream-789',
        assistantMessageUid: 'msg-abc',
        modelConfig,
      }

      const statuses: SessionStatus[] = ['running', 'completed', 'aborted', 'error']

      statuses.forEach((status) => {
        const state: SessionState = {
          config,
          status,
          abortController: mockAbortController,
          startTime: Date.now(),
        }
        expect(state.status).toBe(status)
      })
    })
  })
})
