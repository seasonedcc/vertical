import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import getPort from 'get-port'
import open from 'open'
import type { BoardAction } from '~/state/actions'
import type { StorageAdapter } from './adapters/types.js'

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

type ServerOptions = {
  port?: number
  host?: string
  open?: boolean
  openPath?: string
  config?: Record<string, unknown>
  label?: string
}

function getDistPath() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  return path.resolve(currentDir, '..', '..', 'dist')
}

function readRequestBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

async function readJson(
  req: http.IncomingMessage
): Promise<Record<string, unknown>> {
  const body = await readRequestBody(req)
  return body ? JSON.parse(body) : {}
}

function sendJson(res: http.ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function sendError(res: http.ServerResponse, error: unknown) {
  if (res.headersSent) return
  const err = error as NodeJS.ErrnoException
  const status = err.code === 'ENOENT' ? 404 : 500
  sendJson(res, status, { error: err.message ?? 'Internal error' })
}

function serveStaticFile(
  res: http.ServerResponse,
  distPath: string,
  urlPath: string
) {
  if (!fs.existsSync(distPath)) return false

  const safePath = path.resolve(path.join(distPath, urlPath))
  if (!safePath.startsWith(distPath)) {
    res.writeHead(403)
    res.end('Forbidden')
    return true
  }

  if (!fs.existsSync(safePath) || fs.statSync(safePath).isDirectory()) {
    return false
  }

  const ext = path.extname(safePath)
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
  })
  fs.createReadStream(safePath).pipe(res)
  return true
}

function serveIndex(res: http.ServerResponse, distPath: string) {
  const indexPath = path.join(distPath, 'index.html')
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    fs.createReadStream(indexPath).pipe(res)
    return
  }
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end(
    '<!doctype html><meta charset="utf-8"><title>Vertical</title><p>Run <code>pnpm run build</code> to build the UI.</p>'
  )
}

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  adapter: StorageAdapter,
  distPath: string,
  sseClients: Set<http.ServerResponse>,
  options: ServerOptions
) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const pathname = url.pathname
  const method = req.method ?? 'GET'

  if (pathname === '/api/config' && method === 'GET') {
    return sendJson(res, 200, options.config ?? { adapter: 'local' })
  }

  if (pathname === '/api/webhook/github' && method === 'POST') {
    if (!adapter.handleWebhook)
      return sendJson(res, 404, { error: 'Not found' })
    const body = await readRequestBody(req)
    const result = await adapter.handleWebhook({ headers: req.headers, body })
    return sendJson(res, result.status, result.body ?? { ok: true })
  }

  if (pathname === '/api/events' && method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    res.write(': connected\n\n')
    sseClients.add(res)
    req.on('close', () => sseClients.delete(res))
    return
  }

  if (pathname === '/api/projects' && method === 'GET') {
    return sendJson(res, 200, await adapter.listBoards())
  }

  if (pathname === '/api/projects' && method === 'POST') {
    const body = await readJson(req)
    return sendJson(
      res,
      200,
      await adapter.createBoard(String(body.name ?? ''))
    )
  }

  const actionMatch = pathname.match(/^\/api\/projects\/([^/]+)\/actions$/)
  if (actionMatch && method === 'POST') {
    const id = decodeURIComponent(actionMatch[1])
    const body = await readJson(req)
    const outcome = await adapter.applyAction(
      id,
      body.action as BoardAction,
      String(body.baseRevision ?? '')
    )
    return sendJson(res, 200, outcome)
  }

  const boardMatch = pathname.match(/^\/api\/projects\/([^/]+)$/)
  if (boardMatch) {
    const id = decodeURIComponent(boardMatch[1])
    if (method === 'GET') {
      return sendJson(res, 200, await adapter.loadBoard(id))
    }
    if (method === 'PATCH') {
      const body = await readJson(req)
      return sendJson(
        res,
        200,
        await adapter.renameBoard(id, String(body.name ?? ''))
      )
    }
    if (method === 'DELETE') {
      await adapter.deleteBoard(id)
      return sendJson(res, 200, { ok: true })
    }
  }

  if (serveStaticFile(res, distPath, pathname)) return
  serveIndex(res, distPath)
}

async function startServer(
  adapter: StorageAdapter,
  options: ServerOptions = {}
) {
  const distPath = getDistPath()
  const sseClients = new Set<http.ServerResponse>()

  const server = http.createServer((req, res) => {
    handleRequest(req, res, adapter, distPath, sseClients, options).catch(
      (error) => sendError(res, error)
    )
  })

  const unsubscribe = adapter.subscribe((event) => {
    const payload = `data: ${JSON.stringify(event)}\n\n`
    for (const client of sseClients) client.write(payload)
  })

  const host = options.host ?? 'localhost'
  const port = options.port ?? (await getPort())

  server.listen(port, host, () => {
    const shownHost = host === '0.0.0.0' ? 'localhost' : host
    const url = `http://${shownHost}:${port}`
    console.log(`\n  Vertical is running at ${url}`)
    if (options.label) console.log(`  ${options.label}`)
    console.log('  Press Ctrl+C to stop\n')
    if (options.open) open(url + (options.openPath ?? ''))
  })

  process.on('SIGINT', () => {
    unsubscribe()
    server.close()
    process.exit(0)
  })
}

export { startServer }
export type { ServerOptions }
