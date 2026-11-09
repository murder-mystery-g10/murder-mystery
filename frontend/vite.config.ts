/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, searchForWorkspaceRoot } from 'vite'

// The app calls the backend on its own origin (/api, /socket.io). In development Vite
// proxies these paths; in Docker the frontend container's nginx does.
const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8000'
const themeAssets = fileURLToPath(new URL('../themes/', import.meta.url))

export default defineConfig({
  plugins: [react()],
  // Read VITE_* variables from the repository-root .env (shared with Docker Compose). Vite only
  // exposes variables prefixed with VITE_ to the app, so the other secrets stay out of the bundle.
  envDir: '..',
  server: {
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), themeAssets] },
    proxy: {
      '/api': backendUrl,
      '/socket.io': { target: backendUrl, ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
