import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { useApp } from './store/app'
import './index.css'

// The service worker makes the app installable and usable offline, and it is
// also what shows notifications: `new Notification()` throws a TypeError on
// Android. `autoUpdate` silently loads the next version.
registerSW({ immediate: true })

const root = document.getElementById('root')
if (!root) throw new Error('#root not found')

let started = false
const start = () => {
  if (started) return
  started = true
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

// The saved state is read from IndexedDB, which is asynchronous: rendering
// before it arrives would flash the default timer and theme. A read that hangs
// does not hold the page hostage — nothing is written until it completes.
if (useApp.getState().hydrated) start()
else {
  const stop = useApp.subscribe((state) => {
    if (!state.hydrated) return
    stop()
    start()
  })
  setTimeout(start, 2000)
}
