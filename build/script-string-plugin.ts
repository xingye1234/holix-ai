import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { Rolldown } from 'tsdown'

interface PluginLike {
  name: string
  load?: (id: string) => Promise<string | null> | string | null
}

interface ScriptStringPluginOptions {
  tsconfig?: string
  alias?: Record<string, string>
}

const SCRIPT_QUERY = '?script'
const compiledCache = new Map<string, string>()

function cacheKeyFrom(filePath: string, source: string) {
  return createHash('sha1')
    .update(filePath)
    .update('\n')
    .update(source)
    .digest('hex')
}

export function scriptStringPlugin(options: ScriptStringPluginOptions = {}): PluginLike {
  const {
    tsconfig = 'tsconfig.json',
    alias,
  } = options

  return {
    name: 'script-string-plugin',
    async load(id) {
      if (!id.endsWith(SCRIPT_QUERY))
        return null

      const file = id.slice(0, -SCRIPT_QUERY.length)
      const source = await readFile(file, 'utf-8')
      const cacheKey = cacheKeyFrom(file, source)
      const cached = compiledCache.get(cacheKey)
      if (cached)
        return `export default ${JSON.stringify(cached)};`

      // 使用 tsdown 暴露的 rolldown build（write: false）在内存中编译，避免临时文件 IO。
      const bundle = await Rolldown.build({
        input: file,
        tsconfig,
        platform: 'node',
        external: [/^node:/],
        resolve: alias ? { alias } : undefined,
        output: {
          format: 'cjs',
          sourcemap: false,
          inlineDynamicImports: true,
          exports: 'auto',
        },
        write: false,
      })

      const chunk = bundle.output.find(o => o.type === 'chunk' && o.isEntry)
      if (!chunk || chunk.type !== 'chunk' || typeof chunk.code !== 'string')
        throw new Error(`[script-string-plugin] Failed to compile script: ${file}`)

      compiledCache.set(cacheKey, chunk.code)
      return `export default ${JSON.stringify(chunk.code)};`
    },
  }
}
