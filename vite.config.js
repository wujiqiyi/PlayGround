import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'es2020',
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
})
