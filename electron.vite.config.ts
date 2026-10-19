import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [react()],
    build: {
      rolldownOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          // The full-screen region picker for screen capture.
          capture: resolve(__dirname, 'src/renderer/capture.html')
        }
      }
    }
  }
})
