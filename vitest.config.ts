import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { scriptStringPlugin } from './build/script-string-plugin'

const alias = { '@': new URL('./src', import.meta.url).pathname }

export default defineConfig({
  test: {
    // coverage 必须在顶层，不能放在 ProjectConfig 内
    coverage: {
      provider: 'v8',
      include: ['src/node/chat/skills/**/*.ts'],
      exclude: ['src/node/chat/skills/**/__tests__/**'],
      reporter: ['text', 'html'],
    },
    projects: [
      // ── Node 侧测试（Electron 进程逻辑）────────────────────────────────────
      {
        plugins: [scriptStringPlugin({ tsconfig: 'tsconfig.json', alias }) as any],
        resolve: { alias },
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/node/**/__tests__/**/*.test.ts'],
          globals: true,
          testTimeout: 15000,
          setupFiles: ['./src/node/test-setup.ts'],
        },
      },

      // ── UI 侧测试（React 组件 / Hooks，happy-dom 环境）─────────────────────
      {
        // rolldown-vite 与 vite 插件类型存在版本冲突，强制转换绕过类型检查
        plugins: [react() as any],
        resolve: { alias },
        test: {
          name: 'ui',
          environment: 'happy-dom',
          include: [
            'src/components/**/__tests__/**/*.test.{ts,tsx}',
            'src/views/**/__tests__/**/*.test.{ts,tsx}',
            'src/hooks/**/__tests__/**/*.test.{ts,tsx}',
            'src/store/**/__tests__/**/*.test.{ts,tsx}',
          ],
          globals: true,
          setupFiles: ['./src/test-setup.ts'],
        },
      },
    ],
  },
})
