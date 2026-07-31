/**
 * Wake Lock : empêche l'écran de s'éteindre pendant un focus.
 *
 * Le verrou est libéré automatiquement dès que la page devient masquée, et il
 * n'est **jamais** restauré tout seul : il faut le redemander à chaque retour de
 * visibilité. Un échec (batterie faible, mode économie) est normal et ne doit
 * jamais bloquer le minuteur.
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
      // Déjà relâché.
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
