import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import fs from 'fs'
import path from 'path'

const rootDir = import.meta.dirname || process.cwd()
const certKeyPath = path.resolve(rootDir, 'certs/server.key')
const certCrtPath = path.resolve(rootDir, 'certs/server.crt')
const hasCustomCerts = fs.existsSync(certKeyPath) && fs.existsSync(certCrtPath)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Use basicSsl plugin if custom certs are not provided
    ...(!hasCustomCerts ? [basicSsl()] : [])
  ],
  server: {
    host: '0.0.0.0', // Listen on all network interfaces for LAN access (e.g. Android)
    port: 5173,
    https: hasCustomCerts ? {
      key: fs.readFileSync(certKeyPath),
      cert: fs.readFileSync(certCrtPath),
    } : true,
    // Proxy REST API and WebSocket connections to local FastAPI backend
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
