import type { ProgressInfo, UpdateDownloadedEvent, UpdateInfo } from 'electron-updater'
import type { EventEnvelope } from './base'

export type AutoUpdateAvailable = EventEnvelope<'update.available', { info: UpdateInfo }>

export type AutoUpdateProgress = EventEnvelope<'download.progress', { info: ProgressInfo }>

export type AutoUpdateDownloaded = EventEnvelope<'update.downloaded', { event: UpdateDownloadedEvent }>
export type AutoUpdateError = EventEnvelope<'update.error', { message: string }>

export type AutoUpdateCheck = EventEnvelope<'update.check', { info: any }>
export type AutoUpdateNotAvailable = EventEnvelope<'update.not-available', { info: any }>
export type AutoUpdateCheckingForUpdate = EventEnvelope<'update.checking-for-update', { info: any }>

export type AutoUpdateEnvelope
  = | AutoUpdateAvailable
    | AutoUpdateProgress
    | AutoUpdateDownloaded
    | AutoUpdateError
    | AutoUpdateNotAvailable
    | AutoUpdateCheckingForUpdate
