import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import './index.css'

// Le service worker rend l'app installable et utilisable hors ligne, et c'est
// aussi lui qui affiche les notifications : `new Notification()` lève un
// TypeError sur Android. `autoUpdate` recharge en silence la version suivante.
registerSW({ immediate: true })

const root = document.getElementById('root')
if (!root) throw new Error('#root introuvable')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
