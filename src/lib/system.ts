import { kyInstance } from './ky'

export function minimize() {
  kyInstance.post('window/minimize')
}

export function toggleMaximize() {
  kyInstance.post('window/maximize')
}

export function close() {
  kyInstance.post('window/close')
}

export function toggleDevTools() {
  return kyInstance.post('window/devtools')
}

export async function getAppVersion() {
  return kyInstance.get('window/version').json<{ version: string }>()
}

export function openExternal(url: string) {
  return kyInstance.post('window/open-external', { json: { url } })
}

export function checkForUpdates() {
  return kyInstance.post('window/check-update')
}

export function installUpdateAndQuit() {
  return kyInstance.post('window/install-update')
}
