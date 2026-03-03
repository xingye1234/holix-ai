/**
 * tsdown 内置 Skills 编译配置
 *
 * 将 skills/<name>/index.ts 编译为 .holix/builtin-skills/<name>/index.js（CJS 格式）
 * 供 SkillManager 在运行时通过沙箱机制加载。
 *
 * 编译命令：
 *   pnpm build:skills       # 生产
 *   pnpm build:skills:watch # 监听模式（开发）
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { defineConfig } from 'tsdown'

const cwd = process.cwd()
const skillsSrc = join(cwd, 'skills')
const skillsDest = join(cwd, '.holix/builtin-skills')

// ─── 扫描 skills/ 目录，找出所有含 index.ts 的子目录 ────────────────────────────

const skillNames = readdirSync(skillsSrc, { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(join(skillsSrc, d.name, 'index.ts')))
  .map(d => d.name)

// ─── 为每个 skill 生成独立的 tsdown 配置 ────────────────────────────────────────

export default skillNames.map(name =>
  defineConfig({
    entry: `skills/${name}/index.ts`,
    outDir: `.holix/builtin-skills/${name}`,

    // CJS 格式：与沙箱 vm 执行模型兼容
    format: 'cjs',
    platform: 'node',
    target: 'node18',

    // 强制输出文件名为 index.js（skill.json 中 "file": "index.js" 引用此文件）
    outputOptions: {
      entryFileNames: 'index.js',
    },

    // Node 内置模块保持 require() 引用（沙箱在运行时注入受控版本）
    external: [/^node:/],

    // 无类型声明（运行时 JS 即可）
    dts: false,

    // 不需要 shims（沙箱环境已提供必要的全局）
    shims: false,

    hooks: {
      // 编译前：确保输出目录存在，并复制 skill.json 到目标目录
      'build:prepare': async () => {
        const destDir = join(skillsDest, name)
        mkdirSync(destDir, { recursive: true })

        const srcManifest = join(skillsSrc, name, 'skill.json')
        if (existsSync(srcManifest)) {
          copyFileSync(srcManifest, join(destDir, 'skill.json'))
        }
      },
    },
  }),
)
