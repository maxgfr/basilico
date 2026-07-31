/**
 * Assembles the folder Chrome can load: the Vite build produces the scripts, all
 * that's left is dropping the manifest and the icons in.
 *
 * The manifest is deliberately not a Vite asset: it must stay readable and
 * editable by hand, and hashing it would break loading the extension.
 */
import { cp, readFile, writeFile } from 'node:fs/promises'

const manifest = JSON.parse(await readFile('manifest.json', 'utf8'))

// The manifest version follows the package's: a single source of truth.
const pkg = JSON.parse(await readFile('package.json', 'utf8'))
manifest.version = pkg.version

await writeFile('dist/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`)
await cp('icons', 'dist/icons', { recursive: true })

console.log('dist/ ready — Chrome → Extensions → Load unpacked')
