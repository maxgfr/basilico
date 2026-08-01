#!/usr/bin/env node
/**
 * Bundles the CLI into the single file the skill ships.
 *
 * `npx skills add` copies a directory — no build, no `npm install` — so the
 * engine has to be self-contained. The core exports raw TypeScript and depends
 * on zod, hence a bundle rather than a plain copy.
 *
 * The result is committed, and `--check` is what stops it from quietly drifting
 * away from the source it was built from. A generated artefact in a repository
 * without that guard eventually lies.
 */
import { build } from 'esbuild'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'skills', 'basilico', 'scripts', 'basilico.mjs')

const result = await build({
  entryPoints: [join(root, 'packages', 'cli', 'src', 'main.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  banner: { js: '#!/usr/bin/env node' },
  legalComments: 'none',
  // Minified because zod alone is half a megabyte here — esbuild will not shake
  // out its locale barrel — and because nobody reads a vendored bundle. The
  // source is `packages/cli`, and `--check` is what proves this matches it.
  minify: true,
  write: false,
})

const bundled = result.outputFiles[0].text

if (process.argv.includes('--check')) {
  const committed = await readFile(out, 'utf8').catch(() => null)
  if (committed === bundled) {
    process.stdout.write('skill bundle is up to date\n')
  } else {
    process.stderr.write(`skill bundle is stale — run \`pnpm build:skill\` and commit ${out}\n`)
    process.exitCode = 1
  }
} else {
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, bundled, 'utf8')
  process.stdout.write(`${out} — ${(bundled.length / 1024).toFixed(0)} kB\n`)
}
