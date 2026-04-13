import { defineConfig } from 'vitest/config'
import { scriptStringPlugin } from './build/script-string-plugin'

const alias = { '@': new URL('./src', import.meta.url).pathname }

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [scriptStringPlugin({ tsconfig: 'tsconfig.json', alias }) as any],
        resolve: { alias },
        test: {
          name: 'node-aimock',
          environment: 'node',
          include: ['src/node/**/__tests__/**/*.aimock.test.ts'],
          globals: true,
          testTimeout: 30000,
          setupFiles: ['./src/node/test-setup.ts', './src/node/test-setup.aimock.ts'],
        },
      },
    ],
  },
})
