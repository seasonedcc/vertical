import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['cli/index.ts'],
  format: ['esm'],
  outDir: 'cli/dist',
  banner: {
    js: '#!/usr/bin/env node',
  },
  esbuildOptions(options) {
    options.alias = {
      '~': './app',
    }
  },
})
