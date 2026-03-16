import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import getPort from 'get-port'
import open from 'open'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function getDistPath() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  return path.resolve(currentDir, '..', '..', 'dist')
}

function serveStaticFile(
  res: http.ServerResponse,
  distPath: string,
  urlPath: string
) {
  const filePath = path.join(distPath, urlPath)
  const safePath = path.resolve(filePath)

  if (!safePath.startsWith(distPath)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  if (!fs.existsSync(safePath) || fs.statSync(safePath).isDirectory()) {
    return false
  }

  const ext = path.extname(safePath)
  const contentType = MIME_TYPES[ext] || 'application/octet-stream'

  res.writeHead(200, { 'Content-Type': contentType })
  fs.createReadStream(safePath).pipe(res)
  return true
}

function readRequestBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

async function startServer(filePath: string) {
  const absoluteFilePath = path.resolve(filePath)
  const distPath = getDistPath()

  if (!fs.existsSync(distPath)) {
    console.error(
      'Error: dist/ directory not found. Run `pnpm run build` first.'
    )
    process.exit(1)
  }

  const server = http.createServer(async (req, res) => {
    const url = req.url || '/'

    if (url === '/api/project' && req.method === 'GET') {
      const content = fs.readFileSync(absoluteFilePath, 'utf-8')
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(content)
      return
    }

    if (url === '/api/project' && req.method === 'POST') {
      const body = await readRequestBody(req)
      fs.writeFileSync(absoluteFilePath, body)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end('{"ok":true}')
      return
    }

    if (serveStaticFile(res, distPath, url)) return

    const indexPath = path.join(distPath, 'index.html')
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      fs.createReadStream(indexPath).pipe(res)
      return
    }

    res.writeHead(404)
    res.end('Not Found')
  })

  const port = await getPort()
  const url = `http://localhost:${port}`

  server.listen(port, () => {
    console.log(`\n  Vertical is running at ${url}`)
    console.log(`  Editing: ${absoluteFilePath}`)
    console.log('  Press Ctrl+C to stop\n')
    open(url)
  })
}

export { startServer }
