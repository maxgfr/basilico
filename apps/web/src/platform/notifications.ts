/**
 * System notifications.
 *
 * Always through `ServiceWorkerRegistration.showNotification`: the
 * `new Notification()` constructor throws a `TypeError` on Android and supports
 * no action buttons. The constructor is only a fallback when no service worker
 * is registered (dev without the PWA).
 *
 * None of this works with the tab closed: that would need Web Push, hence a
 * server and VAPID keys, which we deliberately don't have. The Notification
 * Triggers API, which would have solved it server-free, was abandoned by Chrome.
 */

export type NotificationPermissionState = 'unsupported' | NotificationPermission

const TAG = 'basilico-session'

export function permissionState(): NotificationPermissionState {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

/**
 * Only ever call this from an explicit user gesture. Browsers auto-reject a
 * request made on load, and a refusal is **final**: code can never ask again.
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
    // `renotify` re-alerts when a notification with the same tag is replaced,
    // instead of silently stacking five. It only exists on the service worker
    // path, which TypeScript's `NotificationOptions` does not cover.
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
    // No service worker: fall through to the constructor below.
  }

  try {
    // `renotify` without a service worker throws on some platforms.
    // oxlint-disable-next-line no-new -- the API returns nothing useful
    new Notification(title, { body, tag: TAG })
  } catch {
    // Notifications impossible here (Android without SW): sound and the tab title do the job.
  }
}
