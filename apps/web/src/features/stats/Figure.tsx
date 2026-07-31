import type { ReactNode } from 'react'

type Props = {
  title: string
  /** Résumé lu avant le détail chiffré. */
  summary: string
  columns: [string, string]
  /** Les mêmes chiffres que le graphe : sélectionnables, copiables, lus à voix haute. */
  rows: [string, string][]
  children: ReactNode
  action?: ReactNode
}

/**
 * Enveloppe accessible commune à tous les graphes.
 *
 * Le dessin est marqué `aria-hidden` et c'est le tableau `sr-only` qui porte
 * l'information : un lecteur d'écran obtient les valeurs exactes plutôt qu'une
 * description approximative. Un graphe en canvas, lui, ne rend rien du tout dans
 * l'arbre d'accessibilité — c'est la raison principale pour laquelle ces graphes
 * sont écrits à la main plutôt que pris dans une bibliothèque.
 */
export function Figure({ title, summary, columns, rows, children, action }: Props) {
  return (
    <figure className="border-ink-800 bg-ink-900/40 rounded-xl border p-5">
      <figcaption className="mb-4 flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-medium">{title}</h3>
        {action}
      </figcaption>

      {/*
        Ce conteneur peut défiler horizontalement sur les petits écrans (la
        heatmap fait 53 colonnes). Un `tabindex` le rend atteignable au clavier :
        sans lui, son contenu n'est accessible qu'à la souris. WCAG 2.1.1.
      */}
      <div
        className="focus-visible:outline-ink-300 overflow-x-auto rounded focus-visible:outline-2 focus-visible:outline-offset-4"
        tabIndex={0}
        role="group"
        aria-label={`${title} — scrollable chart`}
      >
        {children}
      </div>

      <table className="sr-only">
        <caption>
          {title} — {summary}
        </caption>
        <thead>
          <tr>
            <th scope="col">{columns[0]}</th>
            <th scope="col">{columns[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
