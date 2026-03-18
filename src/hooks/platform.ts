import { useMemo } from 'react'

export type OS
  = | 'windows'
    | 'macos'
    | 'linux'
    | 'android'
    | 'ios'
    | 'unknown'

export function usePlatform() {
  return useMemo(() => {
    if (typeof navigator === 'undefined') {
      return {
        os: 'unknown' as const,
        isWindows: false,
        isMacOS: false,
        isLinux: false,
        isAndroid: false,
        isIOS: false,
      }
    }

    const ua = navigator.userAgent

    const isWindows = /Windows NT/i.test(ua)
    const isMacOS = /Mac OS X/i.test(ua) && !/iPhone|iPad/i.test(ua)
    const isLinux = /Linux/i.test(ua) && !/Android/i.test(ua)
    const isAndroid = /Android/i.test(ua)
    const isIOS = /iPhone|iPad|iPod/i.test(ua)

    let os: OS = 'unknown'

    if (isWindows)
      os = 'windows'
    else if (isMacOS)
      os = 'macos'
    else if (isLinux)
      os = 'linux'
    else if (isAndroid)
      os = 'android'
    else if (isIOS)
      os = 'ios'

    return {
      os,
      isWindows,
      isMacOS,
      isLinux,
      isAndroid,
      isIOS,
    }
  }, [])
}
