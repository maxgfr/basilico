import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import './index.css'

// The service worker makes the app installable and usable offline, and it is
// also what shows notifications: `new Notification()` throws a TypeError on
// Android. `autoUpdate` silently loads the next version.
registerSW({ immediate: true })

const root = document.getElementById('root')
if (!root) throw new Error('#root not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
