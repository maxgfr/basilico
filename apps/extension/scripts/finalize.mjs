/**
 * Assemble le paquet chargeable par Chrome : le build Vite produit les scripts,
 * il reste à y déposer le manifeste et les icônes.
 *
 * Le manifeste n'est volontairement pas un asset Vite : il doit rester lisible
 * et modifiable à la main, et le hacher casserait le chargement de l'extension.
 */
import { cp, readFile, writeFile } from 'node:fs/promises'

const manifest = JSON.parse(await readFile('manifest.json', 'utf8'))

// La version du manifeste suit celle du paquet : une seule source de vérité.
const pkg = JSON.parse(await readFile('package.json', 'utf8'))
manifest.version = pkg.version

await writeFile('dist/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`)
await cp('icons', 'dist/icons', { recursive: true })

console.log('dist/ prêt — Chrome → Extensions → Charger l’extension non empaquetée')
