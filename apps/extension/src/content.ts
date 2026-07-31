import { FROM_APP, FROM_EXTENSION, type AppMessage } from './protocol'

/**
 * Pont entre la page et l'extension.
 *
 * La page ne peut pas parler directement au service worker sans connaître
 * l'identifiant de l'extension, qui diffère entre une installation en mode
 * développeur et une publication au Store. Ce content script relaie donc dans
 * les deux sens, et signale sa présence pour que l'app sache qu'elle peut
 * déléguer ses alertes.
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

  // Le `ping` reçoit sa réponse ici, sans passer par le service worker :
  // le content script tourne à `document_start`, donc son annonce spontanée
  // part souvent avant que l'application n'ait posé son écouteur.
  if (message.type === 'ping') {
    announce()
    return
  }

  // Le service worker peut être endormi : l'échec d'envoi n'est pas une erreur.
  void chrome.runtime.sendMessage(message).catch(() => {})
})

announce()
window.addEventListener('DOMContentLoaded', announce)
