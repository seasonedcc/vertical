import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import readline from 'node:readline'
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

function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  rl.on('error', () => {})
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'y')
    })
  })
}

async function startServer(filePath: string) {
  const absoluteFilePath = path.resolve(filePath)
  const distPath = getDistPath()
  let browserDirty = false

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

    if (url === '/api/events' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      sseClients.add(res)
      req.on('close', () => sseClients.delete(res))
      return
    }

    if (url === '/api/dirty' && req.method === 'POST') {
      const body = await readRequestBody(req)
      browserDirty = JSON.parse(body).dirty
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

  const sseClients = new Set<http.ServerResponse>()

  fs.watch(absoluteFilePath, () => {
    for (const client of sseClients) {
      client.write('data: file-changed\n\n')
    }
  })

  server.listen(port, () => {
    console.log(`\n  Vertical is running at ${url}`)
    console.log(`  Editing: ${absoluteFilePath}`)
    console.log('  Press Ctrl+C to stop\n')
    open(url)
  })

  process.on('SIGINT', async () => {
    if (browserDirty) {
      try {
        const shouldQuit = await confirm(
          '\n  There are unsaved changes in the browser. Quit anyway? (y/N) '
        )
        if (!shouldQuit) {
          console.log('  Resuming...\n')
          return
        }
      } catch {
        // stdin error (e.g. second Ctrl+C), force quit
      }
    }
    server.close()
    process.exit(0)
  })
}

export { startServer }
