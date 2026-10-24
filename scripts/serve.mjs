import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

const root = resolve(process.argv[2] || process.env.DEPLOY_DIR || 'dist')
const port = Number(process.env.PORT || process.argv[3] || 3000)

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg'
}

function safePath(pathname) {
  const decoded = decodeURIComponent(pathname)
  const target = resolve(root, '.' + decoded)
  if (target !== root && !target.startsWith(root + sep)) return null
  return target
}

async function resolveFile(pathname) {
  const target = safePath(pathname)
  if (!target) return null
  try {
    const info = await stat(target)
    if (info.isDirectory()) {
      const index = resolve(target, 'index.html')
      const indexInfo = await stat(index)
      return indexInfo.isFile() ? index : null
    }
    return info.isFile() ? target : null
  } catch {
    if (!extname(target)) {
      try {
        const index = resolve(root, 'index.html')
        const indexInfo = await stat(index)
        return indexInfo.isFile() ? index : null
      } catch {
        return null
      }
    }
    return null
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost')
    if (url.pathname === '/__health') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify({ ok: true }))
      return
    }
    const file = await resolveFile(url.pathname)
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not found')
      return
    }
    const body = await readFile(file)
    res.writeHead(200, {
      'Content-Type': types[extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    })
    if (req.method === 'HEAD') res.end()
    else res.end(body)
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Internal server error')
    console.error(error)
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Serving ${root} on http://0.0.0.0:${port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 3000).unref()
  })
}
