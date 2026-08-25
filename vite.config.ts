/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { APP_NAME } from './src/lib/branding.ts'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    {
      name: 'html-app-name',
      transformIndexHtml: (html) => html.replaceAll('{{APP_NAME}}', APP_NAME),
    },
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt': a new deploy no longer takes over a tab silently — the
      // page must call the update itself (src/lib/swUpdate.ts), which is
      // what lets a user be asked instead of a lazily-loaded chunk 404ing
      // mid-session against a stale manifest (specs.md §10.16).
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: APP_NAME,
        short_name: APP_NAME,
        description:
          'Personal finance: income, expenses and assets, synced to your own Google Drive.',
        theme_color: '#0c0d10',
        background_color: '#0c0d10',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'es',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: '/index.html',
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    // `false` would mock every `.css` import to an empty string — including
    // an explicit `?raw` request, which otherwise bypasses CSS processing
    // entirely and should return the file's literal source text. Narrowly
    // un-mocking just `index.css` is what lets `screenChrome.test.ts` pin
    // the `--screen-inset-top` token's actual declaration (specs.md
    // §10.34) instead of asserting against an empty string.
    css: { include: [/index\.css/] },
  },
})
