import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PERMISSIONS,
  normalizeSandboxPermissions,
  requiresApprovalForPermissions,
} from '../types'

describe('normalizeSandboxPermissions', () => {
  it('returns default permissions when input is empty', () => {
    expect(normalizeSandboxPermissions()).toEqual(DEFAULT_PERMISSIONS)
  })

  it('deduplicates and trims string arrays', () => {
    const normalized = normalizeSandboxPermissions({
      allowedBuiltins: [' path ', 'path', '', 'node:fs'],
      allowedEnvKeys: [' API_KEY ', 'API_KEY', ''],
    })

    expect(normalized.allowedBuiltins).toEqual(['path', 'node:fs'])
    expect(normalized.allowedEnvKeys).toEqual(['API_KEY'])
  })

  it('clamps timeout and memory to safe bounds', () => {
    const normalized = normalizeSandboxPermissions({
      timeout: Number.POSITIVE_INFINITY,
      maxMemoryMb: 4096,
    })

    expect(normalized.timeout).toBe(DEFAULT_PERMISSIONS.timeout)
    expect(normalized.maxMemoryMb).toBe(512)

    const low = normalizeSandboxPermissions({ timeout: 1, maxMemoryMb: 1 })
    expect(low.timeout).toBe(100)
    expect(low.maxMemoryMb).toBe(16)
  })
})

describe('requiresApprovalForPermissions', () => {
  it('returns true when risky builtins are requested', () => {
    expect(requiresApprovalForPermissions({ allowedBuiltins: ['node:fs'] })).toBe(true)
  })

  it('returns false for safe builtins only', () => {
    expect(requiresApprovalForPermissions({ allowedBuiltins: ['path', 'node:crypto'] })).toBe(false)
  })
})
