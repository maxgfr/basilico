import type { ReactNode } from 'react'

type Props = {
  title: string
  /** Summary read out before the figures. */
  summary: string
  columns: [string, string]
  /** The same numbers as the chart: selectable, copyable, read aloud. */
  rows: [string, string][]
  children: ReactNode
  action?: ReactNode
}

/**
 * The accessible wrapper shared by every chart.
 *
 * The drawing is `aria-hidden` and the `sr-only` table carries the information:
 * a screen reader gets exact values rather than an approximate description. A
 * canvas chart renders nothing at all into the accessibility tree — that is the
 * main reason these charts are hand-written instead of pulled from a library.
 */
export function Figure({ title, summary, columns, rows, children, action }: Props) {
  return (
    <figure className="border-ink-800 bg-ink-900/40 rounded-xl border p-5">
      <figcaption className="mb-4 flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-medium">{title}</h3>
        {action}
      </figcaption>

      {/*
        This container can scroll horizontally on small screens (the heatmap is
        53 columns wide). A `tabindex` makes it keyboard-reachable: without one,
        its content is mouse-only. WCAG 2.1.1.
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
