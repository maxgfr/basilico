/**
 * Document offscreen : la seule façon de jouer un son depuis une extension MV3,
 * dont le service worker n'a pas d'API audio.
 *
 * La sonnerie est synthétisée plutôt que chargée : aucun fichier à empaqueter,
 * aucune licence à traîner, et le même carillon que dans l'application web.
 */
const PARTIALS = [
  { freq: 880, at: 0, length: 1.4 },
  { freq: 1318.5, at: 0.16, length: 1.4 },
  { freq: 1760, at: 0.32, length: 1.6 },
]

function chime(): void {
  const ctx = new AudioContext()
  const start = ctx.currentTime + 0.02

  for (const partial of PARTIALS) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const at = start + partial.at

    osc.type = 'sine'
    osc.frequency.value = partial.freq
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.3, at + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + partial.length)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(at)
    osc.stop(at + partial.length + 0.05)
  }

  // Le document offscreen se ferme tout seul : le laisser vivre consommerait
  // de la mémoire pour rien jusqu'au prochain redémarrage du navigateur.
  setTimeout(() => void chrome.offscreen.closeDocument().catch(() => {}), 2500)
}

chrome.runtime.onMessage.addListener((message: { target?: string; type?: string }) => {
  if (message.target !== 'offscreen' || message.type !== 'play') return
  chime()
})
