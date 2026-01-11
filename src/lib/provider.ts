import type { AIProvider } from '@/types/provider'
import { kyInstance } from './ky'

export async function getProviders() {
  return await kyInstance.get('providers').json<AIProvider[]>()
}

export async function getProvider(name: string) {
  return await kyInstance.get(`providers/${name}`).json<AIProvider>()
}

export async function addProvider(provider: AIProvider) {
  return await kyInstance.post('providers', { json: provider }).json<AIProvider>()
}

export async function updateProvider(name: string, updates: Partial<AIProvider>) {
  return await kyInstance.put(`providers/${name}`, { json: updates }).json<AIProvider>()
}

export async function removeProvider(name: string) {
  return await kyInstance.delete(`providers/${name}`).json<{ success: boolean }>()
}

export async function toggleProvider(name: string, enabled: boolean) {
  return await kyInstance.patch(`providers/${name}/toggle`, { json: { enabled } }).json<AIProvider>()
}

export async function getDefaultProvider() {
  return await kyInstance.get('providers/default').text()
}

export async function setDefaultProvider(name: string) {
  return await kyInstance.post('providers/default', { json: { name } }).json<{ success: boolean }>()
}
