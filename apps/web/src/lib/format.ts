const pad = (n: number) => String(n).padStart(2, '0')

/** `23:41`, ou `1:05:00` au-delà d'une heure. Toujours à afficher en chiffres tabulaires. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}

/** Le même temps, mais sans les secondes qui défilent : c'est ça qui angoisse. */
export function formatApproximate(ms: number): string {
  const minutes = Math.ceil(ms / 60_000)
  if (ms <= 0) return 'terminé'
  if (minutes <= 1) return 'moins d’une minute'
  if (minutes < 60) return `environ ${minutes} minutes`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `environ ${hours} h` : `environ ${hours} h ${rest}`
}

/** Durée lisible pour les statistiques : `2 h 05`, `45 min`, `—`. */
export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  if (minutes <= 0) return '—'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`
}

export function formatSigned(ms: number): string {
  return ms < 0 ? `+${formatClock(-ms)}` : formatClock(ms)
}

/** « il y a 12 minutes », pour le message de rattrapage. */
export function formatAgo(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return 'à l’instant'
  if (minutes === 1) return 'il y a une minute'
  if (minutes < 60) return `il y a ${minutes} minutes`
  const hours = Math.round(minutes / 60)
  return hours === 1 ? 'il y a une heure' : `il y a ${hours} heures`
}

export const MODE_LABEL = {
  focus: 'Focus',
  shortBreak: 'Pause courte',
  longBreak: 'Pause longue',
} as const
