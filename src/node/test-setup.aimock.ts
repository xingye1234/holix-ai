import process from 'node:process'

const existingNoProxy = process.env.NO_PROXY
const localBypass = '127.0.0.1,localhost'

process.env.NO_PROXY = existingNoProxy
  ? `${existingNoProxy},${localBypass}`
  : localBypass
