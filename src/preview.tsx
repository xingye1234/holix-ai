import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { PreviewWindow } from '@/views/preview/window'
import './styles/globals.css'
import './styles/root.css'

const rootElement = document.getElementById('root')
if (rootElement) {
  createRoot(rootElement).render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <PreviewWindow />
      <Toaster position="top-center" richColors />
    </ThemeProvider>,
  )
}
