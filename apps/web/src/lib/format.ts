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
  if (ms <= 0) return 'done'
  if (minutes <= 1) return 'less than a minute'
  if (minutes < 60) return `about ${minutes} minutes`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `about ${hours}h` : `about ${hours}h ${rest}`
}

/** Durée lisible pour les statistiques : `2h 05`, `45 min`, `—`. */
export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  if (minutes <= 0) return '—'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours}h` : `${hours}h ${pad(rest)}`
}

export function formatSigned(ms: number): string {
  return ms < 0 ? `+${formatClock(-ms)}` : formatClock(ms)
}

/** « 12 minutes ago », pour le message de rattrapage. */
export function formatAgo(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes === 1) return 'a minute ago'
  if (minutes < 60) return `${minutes} minutes ago`
  const hours = Math.round(minutes / 60)
  return hours === 1 ? 'an hour ago' : `${hours} hours ago`
}

export const MODE_LABEL = {
  focus: 'Focus',
  shortBreak: 'Short break',
  longBreak: 'Long break',
} as const
