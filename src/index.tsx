import { enableMapSet } from 'immer'
import { createRoot } from 'react-dom/client'
import App from './App'
import { startMainLogForwarding } from './lib/main-log-forwarding'
import './styles/globals.css'
import './styles/root.css'

enableMapSet()

startMainLogForwarding()

const rootElement = document.getElementById('root')
if (rootElement) {
  createRoot(rootElement).render(<App />)
}
