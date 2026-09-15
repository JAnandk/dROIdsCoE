import build from '@hono/vite-build/cloudflare-pages'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'
import { defineConfig } from 'vite'

// Build-time asset stamp: Workers freeze Date.now() outside request scope,
// so a runtime stamp collapses to ?v0 in production. Injected at build time
// instead — every deploy gets a fresh cache-bust value.
const BUILD_STAMP = 'v' + Date.now().toString(36)

export default defineConfig({
  define: {
    __ASSET_V__: JSON.stringify(BUILD_STAMP)
  },
  plugins: [
    build(),
    devServer({
      adapter,
      entry: 'src/index.tsx'
    })
  ]
})
