import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Polyfill process.env for client-side usage of Google GenAI SDK which expects it
    'process.env': process.env
  }
})