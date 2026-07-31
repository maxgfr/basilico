import { FROM_APP, FROM_EXTENSION, type AppMessage } from './protocol'

/**
 * Bridge between the page and the extension.
 *
 * The page cannot talk to the service worker directly without knowing the
 * extension id, which differs between a developer-mode install and a Store
 * publication. So this content script relays both ways, and announces itself so
 * the app knows it can delegate its alerts.
 */

const announce = () => {
  window.postMessage(
    { source: FROM_EXTENSION, type: 'ready', version: chrome.runtime.getManifest().version },
    window.location.origin,
  )
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return
  const message = event.data as AppMessage | undefined
  if (!message || message.source !== FROM_APP) return

  // The `ping` is answered right here, without going through the service
  // worker: the content script runs at `document_start`, so its spontaneous
  // announcement often fires before the app has attached its listener.
  if (message.type === 'ping') {
    announce()
    return
  }

  // The service worker may be asleep: a failed send is not an error.
  void chrome.runtime.sendMessage(message).catch(() => {})
})

announce()
window.addEventListener('DOMContentLoaded', announce)
