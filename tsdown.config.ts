import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: 'src/node/main.ts',
  outDir: './.holix/main',
  target: 'es2024',
  shims: true,
  platform: 'node',
  publicDir: 'public',
  alias: {
    '@': './src',
    'public': './public',
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
    'build:done': async (ctx) => {
      const isDev = ctx.options.watch
      if (isDev) {
        return
      }

      const pkg = await readJson(join(process.cwd(), 'package.json'))
      const devDependencies = Object.keys(pkg.devDependencies || {})
      const uniqueDeps = Array.from(new Set(devDependencies))

      // 更新 electron-builder.json
      await updateElectronBuilderFiles([...uniqueDeps])
    },
  },
  external: [
    'electron',
    /^@electron\//,
    /^node:/,
  ],
  loader: {
    '.png': 'dataurl',
  },
  outputOptions: {
    chunkFileNames: (chunkInfo) => {
      // 所有 node_modules chunk 输出到 dist/main/vendor
      const modules = Object.keys(chunkInfo.moduleIds)
      const isVendor = modules.some(m => m.includes('node_modules'))
      if (isVendor) {
        return 'vendor/[name]-[hash].js'
      }
      return '[name]-[hash].js'
    },
  },
})

/**
 * 更新 electron-builder.json 文件的 files 字段
 * @param deps 依赖包名称数组
 */
async function updateElectronBuilderFiles(deps: string[]) {
  const electronBuilderPath = join(process.cwd(), 'electron-builder.json')

  try {
    // 读取 electron-builder.json
    const content = await readFile(electronBuilderPath, 'utf-8')
    const config = JSON.parse(content)

    // 生成 node_modules 依赖路径
    const depFiles = deps.map(dep => `!node_modules/${dep}/**/*`)

    // 保留其他非 node_modules 的文件配置
    const otherFiles = (config.files || []).filter(
      (file: string) => !file.startsWith('!node_modules/'),
    )

    // 合并配置
    config.files = Array.from(new Set([...otherFiles, ...depFiles]))

    // 写回文件
    await writeFile(
      electronBuilderPath,
      `${JSON.stringify(config, null, 2)}\n`,
      'utf-8',
    )

    console.log(
      `✓ Updated electron-builder.json with ${deps.length} dependencies`,
    )
  }
  catch (error) {
    console.error('Failed to update electron-builder.json:', error)
  }
}

function readJson(filePath: string) {
  return readFile(filePath, 'utf-8').then(data => JSON.parse(data))
}
