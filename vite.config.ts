// vite.config.ts
import { defineConfig } from 'vite'
import fs from 'node:fs/promises'
import path from 'node:path'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
    plugins: [
    {
      name: 'public-list-endpoint',
            configureServer(server) {
              const publicDir = path.resolve(__dirname, 'public')

                      server.middlewares.use('/public-list', async (req, res, next) => {
          if (!req.url) return next()
          try {
            const url = new URL(req.url, 'http://localhost')
            let relPath = url.searchParams.get('path') || '/'

            // Normalize and force leading slash
            if (!relPath.startsWith('/')) relPath = '/' + relPath
            // Treat plain file-like paths ending without slash as directories only if they actually are

            const fsPath = path.resolve(publicDir, '.' + relPath)
            if (!fsPath.startsWith(publicDir)) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Invalid path' }))
              return
            }

            const stat = await fs.stat(fsPath).catch(() => null)
            if (!stat || !stat.isDirectory()) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Not a directory' }))
              return
            }

            const dirents = await fs.readdir(fsPath, { withFileTypes: true })

            const entries = dirents
              .map((ent) => {
                const childRel = path.posix.join(relPath, ent.name)
                if (ent.isDirectory()) {
                  const p = childRel.endsWith('/') ? childRel : childRel + '/'
                  return {
                    name: ent.name + '/',
                    path: p,
                    type: 'dir' as const,
                  }
                } else {
                  return {
                    name: ent.name,
                    path: childRel,
                    type: 'file' as const,
                  }
                }
            })
            // Sort: dirs first, then files, both alphabetically
              .sort((a, b) => {
                if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
                return a.name.localeCompare(b.name)
            })

            let parent: string | null = null
            const relNoSlash = relPath.replace(/\/$/, '')
            if (relNoSlash && relNoSlash !== '/') {
              const dirName = path.posix.dirname(relNoSlash)
              parent = dirName === '.' ? '/' : dirName + '/'
            }

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ cwd: relPath, parent, entries }))
          } catch (err) {
            console.error('Error in /public-list:', err)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Internal error' }))
          }
                      })
            },
    },
    ],
})



