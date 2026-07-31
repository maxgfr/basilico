/**
 * Generates the PWA's PNG icons from an SVG, through Chromium.
 *
 * One-off script: run `node scripts/make-icons.mjs` when the identity changes and
 * commit the resulting PNGs. No extra build dependency, and no conversion tool
 * to install.
 */
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

const BG = '#0b0f0e'
const TRACK = '#1e2b26'
const RING = '#5cc79a'

/** `inset` leaves the safe margin a maskable icon requires (crop zone). */
const icon = (inset) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BG}"/>
  <g transform="translate(256 256) scale(${1 - inset}) translate(-256 -256)">
    <circle cx="256" cy="256" r="168" fill="none" stroke="${TRACK}" stroke-width="44"/>
    <circle cx="256" cy="256" r="168" fill="none" stroke="${RING}" stroke-width="44"
      stroke-linecap="round" stroke-dasharray="1055.6" stroke-dashoffset="290"
      transform="rotate(-90 256 256)"/>
  </g>
</svg>`

const TARGETS = [
  { file: 'icon-192.png', size: 192, inset: 0 },
  { file: 'icon-512.png', size: 512, inset: 0 },
  { file: 'icon-maskable-512.png', size: 512, inset: 0.22 },
  { file: 'apple-touch-icon.png', size: 180, inset: 0.12 },
]

const browser = await chromium.launch()
await mkdir('public/icons', { recursive: true })

for (const target of TARGETS) {
  const page = await browser.newPage({ viewport: { width: target.size, height: target.size } })
  await page.setContent(
    `<style>html,body{margin:0}svg{display:block;width:100vw;height:100vh}</style>${icon(target.inset)}`,
  )
  await writeFile(`public/icons/${target.file}`, await page.screenshot({ omitBackground: false }))
  await page.close()
  console.log(`public/icons/${target.file} (${target.size}px)`)
}

await browser.close()
