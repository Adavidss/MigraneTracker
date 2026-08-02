/**
 * Rasterises public/favicon.svg into the PNG sizes the web app manifest and iOS
 * need. Run with `npm run icons` after changing the source SVG.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

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
