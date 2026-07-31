/**
 * Wake Lock: keeps the screen from turning off during a focus session.
 *
 * The lock is released automatically as soon as the page becomes hidden, and it
 * is **never** restored on its own: it must be requested again on every return
 * to visibility. A failure (low battery, power-saving mode) is normal and must
 * never block the timer.
 */
export function createWakeLock() {
  let sentinel: WakeLockSentinel | null = null
  let wanted = false

  const acquire = async () => {
    if (!wanted || sentinel !== null) return
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return
    try {
      sentinel = await navigator.wakeLock.request('screen')
      sentinel.addEventListener('release', () => {
        sentinel = null
      })
    } catch {
      sentinel = null
    }
  }

  const release = async () => {
    const current = sentinel
    sentinel = null
    try {
      await current?.release()
    } catch {
      // Already released.
    }
  }

  const onVisibility = () => {
    if (document.visibilityState === 'visible') void acquire()
  }
  document.addEventListener('visibilitychange', onVisibility)

  return {
    set(active: boolean) {
      wanted = active
      if (active) void acquire()
      else void release()
    },
    dispose() {
      document.removeEventListener('visibilitychange', onVisibility)
      wanted = false
      void release()
    },
  }
}
