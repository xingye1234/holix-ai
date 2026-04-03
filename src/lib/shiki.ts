import rehypeShikiFromHighlighter from '@shikijs/rehype/core'
import { createHighlighter, createOnigurumaEngine } from 'shiki'
import { getCodeThemePreset } from './theme-system'

export const shiki = await createHighlighter({
  themes: [
    'github-dark',
    'github-light',
    'vitesse-dark',
    'vitesse-light',
    'catppuccin-latte',
    'catppuccin-mocha',
  ],
  langs: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'bash',
    'go',
    'rust',
    'python',
    'java',
    'css',
    'html',
    'markdown',
    'vue',
    'html',
    'astro',
    'bash',
    'c',
    'cpp',
  ],
  engine: createOnigurumaEngine(() => import('shiki/wasm')),
})

export function createRehypeShiki(codeTheme: Parameters<typeof getCodeThemePreset>[0]) {
  const preset = getCodeThemePreset(codeTheme)

  return [
    rehypeShikiFromHighlighter,
    shiki,
    {
      themes: {
        light: preset.lightTheme,
        dark: preset.darkTheme,
      },
    },
  ] as const
}
