/**
 * Rasterises public/favicon.svg into the PNG sizes the web app manifest and iOS
 * need. Run with `npm run icons` after changing the source SVG.
 *
 * sharp is deliberately not a dependency of this project. The icons it produces
 * are committed, so this runs perhaps twice in the project's life, and keeping
 * sharp out means CI never installs 50MB of image binaries it will not use —
 * and never trips over the platform-specific entries sharp adds to the lock
 * file, which differ between a macOS laptop and a Linux runner.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

let sharp
try {
  sharp = (await import('sharp')).default
} catch {
  console.error(
    'This script needs sharp, which is not installed.\n\n' +
      '  npm install --no-save sharp && npm run icons\n\n' +
      '--no-save keeps it out of package.json and the lock file.',
  )
  process.exit(1)
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = await readFile(join(root, 'public/favicon.svg'))

const OUTPUTS = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  // iOS ignores transparency and squares the corners itself.
  { name: 'apple-touch-icon.png', size: 180 },
]

for (const { name, size } of OUTPUTS) {
  await sharp(source, { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(join(root, 'public', name))
  console.log(`wrote public/${name} (${size}×${size})`)
}

/**
 * Maskable icons are cropped to a circle on some launchers, so the artwork is
 * inset into the safe zone (80% of the canvas) on a solid background.
 */
const MASKABLE = 512
const inner = Math.round(MASKABLE * 0.78)
const pad = Math.round((MASKABLE - inner) / 2)

const artwork = await sharp(source, { density: 384 })
  .resize(inner, inner)
  .png()
  .toBuffer()

const maskable = await sharp({
  create: {
    width: MASKABLE,
    height: MASKABLE,
    channels: 4,
    background: '#5b57c4',
  },
})
  .composite([{ input: artwork, top: pad, left: pad }])
  .png({ compressionLevel: 9 })
  .toBuffer()

await writeFile(join(root, 'public/icon-512-maskable.png'), maskable)
console.log(`wrote public/icon-512-maskable.png (${MASKABLE}×${MASKABLE}, maskable)`)
