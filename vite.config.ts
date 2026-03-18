import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import AutoImport from 'unplugin-auto-import/vite'
import { defineConfig } from 'vite'

export default defineConfig(() => {
  return {
    build: {
      outDir: './.holix/client',
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          preview: path.resolve(__dirname, 'preview.html'),
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        'public': path.resolve(__dirname, './public'),
      },
    },
    plugins: [
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
        routesDirectory: './src/routes',
        generatedRouteTree: './src/routeTree.gen.ts',
      }),
      react(),
      tailwindcss(),
      AutoImport({
        imports: ['react'],
        dirs: [
          './hooks/**',
        ],
      }),
    ],
    server: {
      port: 3456,
    },
  }
})
