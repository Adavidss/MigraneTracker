import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Deployed as a static site on GitHub Pages, where the repository name becomes
// the base path, so every asset URL must be prefixed with it.
const BASE = '/MigraneTracker/'

export default defineConfig({
  base: BASE,
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3130,
    strictPort: true,
  },
  preview: {
    port: 3130,
    strictPort: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'MigraineTracker',
        short_name: 'Migraine',
        description:
          'A private, local-first visual journal for headaches and migraines.',
        theme_color: '#6d5bd0',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: BASE,
        start_url: BASE,
        categories: ['health', 'medical', 'lifestyle'],
        // Long-pressing the home screen icon jumps straight to logging.
        shortcuts: [
          {
            name: 'Log a headache',
            short_name: 'Log',
            url: `${BASE}#/log`,
            icons: [{ src: 'icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'For your doctor',
            short_name: 'Doctor',
            url: `${BASE}#/doctor`,
            icons: [{ src: 'icon-192.png', sizes: '192x192' }],
          },
        ],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Everything is local, so precache the whole shell for offline use.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Charting and report generation are only reached from two screens, so
        // they stay out of the entry chunk.
        manualChunks(id) {
          if (id.includes('node_modules/recharts')) return 'charts'
          if (id.includes('node_modules/jspdf')) return 'reports'
          return undefined
        },
      },
    },
  },
})
