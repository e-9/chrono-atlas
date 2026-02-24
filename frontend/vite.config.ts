/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
