import type { Connect } from 'vite'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

const root = fileURLToPath(new URL('.', import.meta.url))

function rewriteFeatures(): Connect.NextHandleFunction {
  return (req, _res, next) => {
    const path = req.url?.split('?')[0]
    if (path === '/features' || path === '/features/') {
      req.url = '/features/index.html'
    }
    next()
  }
}

function mpaPages(): Plugin {
  return {
    name: 'hilo-mpa-pages',
    configureServer(server) {
      server.middlewares.use(rewriteFeatures())
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewriteFeatures())
    },
  }
}

export default defineConfig({
  appType: 'mpa',
  plugins: [mpaPages()],
  server: { port: 5174, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: `${root}index.html`,
        features: `${root}features/index.html`,
      },
    },
  },
})
