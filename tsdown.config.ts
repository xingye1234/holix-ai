import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { defineConfig } from 'tsdown'

const pkg = await readJson(join(process.cwd(), 'package.json'))
const dependencies = Object.keys(pkg.dependencies || {})
const uniqueDeps = Array.from(new Set(dependencies))
  .filter(name => !name.startsWith('@libsql/'))
  .map(
    name => new RegExp(`^${escapeRegExp(name)}($|/)`),
  )

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default defineConfig({
  entry: 'src/node/main.ts',
  outDir: './.holix/main',
  target: 'es2024',
  shims: true,
  platform: 'node',
  alias: {
    '@': './src',
  },
  treeshake: true,
  hooks: {
    'build:prepare': async (ctx) => {
      const isDev = ((ctx.options as any)['--'] as string[])?.includes('--dev')
      const DEV = isDev ? 'true' : 'false'
      const PROD = isDev ? 'false' : 'true'
      const NODE_ENV = JSON.stringify(isDev ? 'development' : 'production')
      const BASE_URL = JSON.stringify(isDev ? 'http://localhost:3456/' : './client')

      ctx.options.define = {
        'import.meta.env.DEV': DEV,
        'import.meta.env.NODE_ENV': NODE_ENV,
        'import.meta.env.BASE_URL': BASE_URL,
        'import.meta.env.PROD': PROD,
      }

      ctx.options.minify = !isDev
    },
  },
  external: [
    'electron',
    /^@electron\//,
    /^node:/,
    'better-sqlite3'
  ],
  noExternal: uniqueDeps,
  loader: {
    '.png': 'dataurl',
    '.jpg': 'dataurl',
    '.md': 'text',
  },
  outputOptions: {
    manualChunks(id) {
      if (id.includes('node_modules')) {
        // 所有生产依赖进 vendor chunk
        return 'vendor'
      }
    },
    chunkFileNames(chunk) {
      if (chunk.name === 'vendor') {
        return 'vendor/[name]-[hash].js'
      }
      // 其他（源码）
      return '[name]-[hash].js'
    },
  },
})

function readJson(filePath: string) {
  return JSON.parse(readFileSync(filePath, 'utf-8'))
}
