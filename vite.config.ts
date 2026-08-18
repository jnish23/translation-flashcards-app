import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Japanese Flashcards',
        short_name: 'Flashcards',
        description:
          'Ask for natural Japanese with context, save the options as SRS flashcards.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#16171d',
        theme_color: '#16171d',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // No runtime caching on purpose. Precaching covers the app shell, so
        // reviewing cards works offline straight from localStorage. Translation
        // calls go cross-origin to the LLM provider and match no route here, so
        // they always hit the network — no stale responses, and nothing
        // carrying the API key is ever written to the cache.
        runtimeCaching: [],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
})
