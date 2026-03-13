/**
 * ContentExtractor 单元测试
 */

import { describe, it, expect } from 'vitest'
import { ContentExtractor } from '../content-extractor'

describe('ContentExtractor', () => {
  const extractor = new ContentExtractor()

  describe('extractTextDelta', () => {
    it('should extract text from string content', () => {
      const content = 'Hello, world!'
      const result = extractor.extractTextDelta(content)
      expect(result).toBe('Hello, world!')
    })

    it('should extract text from array content (Anthropic/Gemini format)', () => {
      const content = [
        { type: 'text', text: 'Hello, ' },
        { type: 'text', text: 'world!' },
      ]
      const result = extractor.extractTextDelta(content as any)
      expect(result).toBe('Hello, world!')
    })

    it('should filter out non-text content', () => {
      const content = [
        { type: 'text', text: 'Hello' },
        { type: 'image_url', image_url: { url: 'https://example.com/image.png' } },
        { type: 'text', text: 'world' },
      ]
      const result = extractor.extractTextDelta(content as any)
      expect(result).toBe('Helloworld')
    })

    it('should return empty string for empty array', () => {
      const content: any[] = []
      const result = extractor.extractTextDelta(content as any)
      expect(result).toBe('')
    })
  })

  describe('extractImageContent', () => {
    it('should extract image URLs', () => {
      const content = [
        { type: 'image_url', image_url: { url: 'https://example.com/image1.png' } },
        { type: 'image_url', image_url: { url: 'https://example.com/image2.png' } },
      ]
      const result = extractor.extractImageContent(content as any)
      expect(result).toHaveLength(2)
      expect(result[0].url).toBe('https://example.com/image1.png')
      expect(result[1].url).toBe('https://example.com/image2.png')
    })

    it('should handle base64 images', () => {
      const content = [
        { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw0KG...' } },
      ]
      const result = extractor.extractImageContent(content as any)
      expect(result).toHaveLength(1)
      expect(result[0].base64).toBe('data:image/png;base64,iVBORw0KG...')
    })

    it('should return empty array for string content', () => {
      const content = 'Hello, world!'
      const result = extractor.extractImageContent(content as any)
      expect(result).toEqual([])
    })
  })

  describe('hasMultimedia', () => {
    it('should return true for content with images', () => {
      const content = [
        { type: 'text', text: 'Hello' },
        { type: 'image_url', image_url: { url: 'https://example.com/image.png' } },
      ]
      const result = extractor.hasMultimedia(content as any)
      expect(result).toBe(true)
    })

    it('should return false for text-only content', () => {
      const content = [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: 'world' },
      ]
      const result = extractor.hasMultimedia(content as any)
      expect(result).toBe(false)
    })

    it('should return false for string content', () => {
      const content = 'Hello, world!'
      const result = extractor.hasMultimedia(content as any)
      expect(result).toBe(false)
    })
  })

  describe('extractContentTypes', () => {
    it('should extract content types from array', () => {
      const content = [
        { type: 'text', text: 'Hello' },
        { type: 'image_url', image_url: { url: 'https://example.com/image.png' } },
        { type: 'text', text: 'world' },
      ]
      const result = extractor.extractContentTypes(content as any)
      expect(result).toEqual(['text', 'image_url'])
    })

    it('should return ["text"] for string content', () => {
      const content = 'Hello, world!'
      const result = extractor.extractContentTypes(content as any)
      expect(result).toEqual(['text'])
    })

    it('should deduplicate types', () => {
      const content = [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: 'world' },
      ]
      const result = extractor.extractContentTypes(content as any)
      expect(result).toEqual(['text'])
    })
  })
})
