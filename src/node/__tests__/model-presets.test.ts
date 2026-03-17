import { describe, expect, it } from 'vitest'
import { ALL_MODELS, VENDOR_PRESETS } from '../../share/models'

describe('vENDOR_PRESETS', () => {
  it('has exactly 8 vendors', () => {
    expect(VENDOR_PRESETS).toHaveLength(8)
  })

  it('each vendor has required fields', () => {
    for (const v of VENDOR_PRESETS) {
      expect(typeof v.id).toBe('string')
      expect(typeof v.name).toBe('string')
      expect(typeof v.avatar).toBe('string')
      expect(typeof v.baseUrl).toBe('string')
      expect(Array.isArray(v.models)).toBe(true)
      expect(v.models.length).toBeGreaterThan(0)
    }
  })

  it('has unique vendor IDs', () => {
    const ids = VENDOR_PRESETS.map(v => v.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('aLL_MODELS', () => {
  it('is a flat string array', () => {
    expect(Array.isArray(ALL_MODELS)).toBe(true)
    expect(ALL_MODELS.every(m => typeof m === 'string')).toBe(true)
  })

  it('contains spot-checked model IDs', () => {
    expect(ALL_MODELS).toContain('gpt-4.1')
    expect(ALL_MODELS).toContain('claude-sonnet-4-6')
    expect(ALL_MODELS).toContain('gemini-2.5-pro')
    expect(ALL_MODELS).toContain('deepseek-chat')
  })

  it('length equals sum of all vendor model counts', () => {
    const total = VENDOR_PRESETS.reduce((sum, v) => sum + v.models.length, 0)
    expect(ALL_MODELS).toHaveLength(total)
  })
})
