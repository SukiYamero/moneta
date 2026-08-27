import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import basicSsl from '@vitejs/plugin-basic-ssl'
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
    // crypto.randomUUID needs a secure context; plain http://<lan-ip> doesn't have one.
    process.env.VITE_DEV_HTTPS === 'true' && basicSsl(),
  ],
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, '.claude/worktrees/**'],
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    // css: false would mock every .css import to an empty string, including
    // an explicit ?raw request, which otherwise bypasses CSS processing entirely.
    css: { include: [/index\.css/] },
  },
})
