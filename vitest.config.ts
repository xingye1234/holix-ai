import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const alias = { '@': new URL('./src', import.meta.url).pathname }

export default defineConfig({
  test: {
    projects: [
      // ── Node 侧测试（Electron 进程逻辑）────────────────────────────────────
      {
        resolve: { alias },
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/node/**/__tests__/**/*.test.ts'],
          globals: true,
          testTimeout: 15000,
          coverage: {
            provider: 'v8',
            include: ['src/node/chat/skills/**/*.ts'],
            exclude: ['src/node/chat/skills/**/__tests__/**'],
            reporter: ['text', 'html'],
          },
        },
      },

      // ── UI 侧测试（React 组件 / Hooks，happy-dom 环境）─────────────────────
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'ui',
          environment: 'happy-dom',
          include: [
            'src/components/**/__tests__/**/*.test.{ts,tsx}',
            'src/hooks/**/__tests__/**/*.test.{ts,tsx}',
          ],
          globals: true,
          setupFiles: ['./src/test-setup.ts'],
        },
      },
    ],
  },
})
