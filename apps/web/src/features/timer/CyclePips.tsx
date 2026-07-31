type Props = { done: number; total: number }

/**
 * Position dans le cycle, en pastilles plutôt qu'en « 2/4 » : lisible d'un coup
 * d'œil sans lire de chiffre. Le libellé textuel reste disponible aux lecteurs
 * d'écran, la couleur seule ne porte jamais l'information.
 */
export function CyclePips({ done, total }: Props) {
  const filled = Math.min(done, total)
  return (
    <span
      className="flex items-center gap-1.5"
      role="img"
      aria-label={`${done} of ${total} focus sessions before the long break`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={
            i < filled
              ? 'h-1.5 w-1.5 rounded-full bg-current'
              : 'border-ink-600 h-1.5 w-1.5 rounded-full border'
          }
        />
      ))}
    </span>
  )
}
