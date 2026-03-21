import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { defineConfig } from 'tsdown'
import { scriptStringPlugin } from './build/script-string-plugin'

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
      // 在开发和生产环境都启用 source maps
      ctx.options.sourcemap = true
    },
  },
  external: [
    'electron',
    /^@electron\//,
    /^node:/,
    'better-sqlite3',
  ],
  noExternal: uniqueDeps,
  plugins: [scriptStringPlugin({ tsconfig: 'tsconfig.json', alias: { '@': './src' } }) as any],
  loader: {
    '.png': 'dataurl',
    '.jpg': 'dataurl',
    '.md': 'text',
  },
  outputOptions: {
    manualChunks(id) {
      if (!id.includes('node_modules'))
        return

      // pnpm 路径形如: node_modules/.pnpm/<pkg>@ver/node_modules/<actual-pkg>/file.js
      // 需要取最后一个 node_modules/ 之后的真实包名
      const segments = id.split(/[/\\]node_modules[/\\]/)
      const last = segments[segments.length - 1]

      // 提取包名：兼容 scoped 包（@scope/pkg）和普通包
      const match = last.match(/^((@[^/\\]+)[/\\]([^/\\]+)|([^/\\]+))/)
      if (match) {
        const pkgName = match[1]
          .replace(/^@/, '') // 去掉开头的 @
          .replace(/[/\\+@]/g, '_') // 其余特殊字符统一替换为 _
        return `vendor/${pkgName}`
      }

      return 'vendor/_unknown'
    },
    chunkFileNames: '[name]_[hash].js',
  },
})

function readJson(filePath: string) {
  return JSON.parse(readFileSync(filePath, 'utf-8'))
}
