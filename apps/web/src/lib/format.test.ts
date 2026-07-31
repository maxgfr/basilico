import { describe, expect, it } from 'vitest'
import { formatAgo, formatApproximate, formatClock, formatDuration, formatSigned } from './format'

describe('formatage du temps', () => {
  it('arrondit vers le haut pour ne jamais afficher 00:00 avant la fin', () => {
    // 500 ms restantes doivent se lire 00:01, pas 00:00 : sinon le minuteur
    // semble terminé une seconde avant de sonner.
    expect(formatClock(500)).toBe('00:01')
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(-5000)).toBe('00:00')
  })

  it('passe aux heures au-delà de 60 minutes', () => {
    expect(formatClock(25 * 60_000)).toBe('25:00')
    expect(formatClock(65 * 60_000)).toBe('1:05:00')
  })

  it('affiche le dépassement en positif', () => {
    expect(formatSigned(-90_000)).toBe('+01:30')
    expect(formatSigned(90_000)).toBe('01:30')
  })

  it('reste vague en mode approximatif', () => {
    expect(formatApproximate(24 * 60_000)).toBe('environ 24 minutes')
    expect(formatApproximate(30_000)).toBe('moins d’une minute')
    expect(formatApproximate(0)).toBe('terminé')
    expect(formatApproximate(120 * 60_000)).toBe('environ 2 h')
  })

  it('résume les durées de statistiques', () => {
    expect(formatDuration(0)).toBe('—')
    expect(formatDuration(45 * 60_000)).toBe('45 min')
    expect(formatDuration(125 * 60_000)).toBe('2 h 05')
    expect(formatDuration(120 * 60_000)).toBe('2 h')
  })

  it('dit depuis quand une session est terminée', () => {
    expect(formatAgo(20_000)).toBe('à l’instant')
    expect(formatAgo(12 * 60_000)).toBe('il y a 12 minutes')
    expect(formatAgo(60 * 60_000)).toBe('il y a une heure')
  })
})
