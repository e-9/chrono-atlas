/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
        // Let the SWA's navigationFallback handle HTML navigation (preserves CSP headers).
        // Don't precache index.html or use NavigationRoute — avoids serving stale/headerless HTML.
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: /\/data\/countries-110m\.json$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'topojson-data',
              expiration: { maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /\/api\/v1\/events/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'events-api',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 },
            },
          },
          // Google Fonts caching removed — browser's HTTP cache handles this
          // (Google sets Cache-Control: max-age=31536000 on font files).
          // SW CacheFirst was causing stale font CSS on reload.
        ],
      },
      manifest: false,
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          d3: ['d3', 'd3-geo', 'topojson-client'],
          react: ['react', 'react-dom', '@tanstack/react-query'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    exclude: ['e2e/**', 'node_modules/**'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        timeout: 120000, // 2 min — first load geocodes many places
      },
    },
  },
})
