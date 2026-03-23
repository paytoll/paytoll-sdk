import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: {
      'index': 'src/index.ts',
      'middleware/express': 'src/middleware/express.ts',
      'middleware/hono': 'src/middleware/hono.ts',
      'cli/index': 'src/cli/index.ts',
    },
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
    external: ['express', 'hono'],
  },
])
