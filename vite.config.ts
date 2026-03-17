import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tailwindcss(), tsconfigPaths()],
  server: {
    port: 4007,
    hmr: { port: 24685 },
    proxy: {
      '/api': 'http://localhost:3456',
    },
  },
})
