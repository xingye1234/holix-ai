import { enableMapSet } from 'immer'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import './styles/root.css'

enableMapSet()

const rootElement = document.getElementById('root')
if (rootElement) {
  createRoot(rootElement).render(<App />)
}
