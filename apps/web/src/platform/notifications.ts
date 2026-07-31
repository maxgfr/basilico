/**
 * Notifications système.
 *
 * On passe toujours par `ServiceWorkerRegistration.showNotification` : le
 * constructeur `new Notification()` lève un `TypeError` sur Android et ne
 * supporte pas les boutons d'action. Le constructeur ne sert que de repli quand
 * aucun service worker n'est enregistré (dev sans PWA).
 *
 * Rien de tout ça ne fonctionne onglet fermé : ça exigerait le Web Push, donc un
 * serveur et des clés VAPID, qu'on n'a pas par choix. L'API Notification Triggers,
 * qui aurait résolu le problème sans serveur, a été abandonnée par Chrome.
 */

export type NotificationPermissionState = 'unsupported' | NotificationPermission

const TAG = 'basilico-session'

export function permissionState(): NotificationPermissionState {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

/**
 * À n'appeler que depuis un geste utilisateur explicite. Une demande au
 * chargement est refusée d'office par les navigateurs, et un refus est
 * **définitif** : il ne peut plus être redemandé par le code.
 */
export async function requestPermission(): Promise<NotificationPermissionState> {
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

export async function notify(title: string, body: string): Promise<void> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

  const options = {
    body,
    tag: TAG,
    // `renotify` réalerte quand une notification du même tag est remplacée, au lieu
    // d'en empiler cinq en silence. Il n'existe que sur le chemin service worker,
    // que la définition TypeScript de `NotificationOptions` ne couvre pas.
    renotify: true,
    icon: `${import.meta.env.BASE_URL}favicon.svg`,
    badge: `${import.meta.env.BASE_URL}favicon.svg`,
  } satisfies NotificationOptions & { renotify: boolean }

  try {
    const registration = await navigator.serviceWorker?.getRegistration()
    if (registration) {
      await registration.showNotification(title, options)
      return
    }
  } catch {
    // Pas de service worker : on tente le constructeur ci-dessous.
  }

  try {
    // `renotify` sans service worker lève sur certaines plateformes.
    // oxlint-disable-next-line no-new -- l'API ne rend rien d'utile
    new Notification(title, { body, tag: TAG })
  } catch {
    // Notification impossible ici (Android sans SW) : le son et l'onglet suffisent.
  }
}
