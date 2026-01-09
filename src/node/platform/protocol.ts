import process from 'node:process'
import { protocol } from 'electron'
import { SCHEME } from '../constant'

// ============================================
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

// ============================================
// 协议注册
// ============================================
protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      allowServiceWorkers: true,
    },
  },
])
