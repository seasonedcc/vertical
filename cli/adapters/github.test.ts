import crypto from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { serialize } from '~/file/format'
import { createBlankProject } from '~/state/initial-state'
import { boardReducer } from '~/state/reducer'
import type { BoardState } from '~/state/types'
import { createGithubAdapter } from './github.js'

type MockResponse = {
  status?: number
  body?: unknown
  headers?: Record<string, string>
}
type Handler = (
  method: string,
  url: string,
  body: Record<string, unknown> | undefined
) => MockResponse | undefined

type Call = {
  method: string
  url: string
  body: Record<string, unknown> | undefined
}

function stub(handler: Handler) {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      const parsed = init?.body ? JSON.parse(init.body as string) : undefined
      calls.push({ method, url, body: parsed })
      const result = handler(method, url, parsed) ?? { status: 200, body: null }
      const status = result.status ?? 200
      const text = result.body == null ? '' : JSON.stringify(result.body)
      return {
        ok: status >= 200 && status < 300,
        status,
        statusText: `HTTP ${status}`,
        text: async () => text,
        headers: {
          get: (key: string) => result.headers?.[key.toLowerCase()] ?? null,
        },
      }
    })
  )
  return calls
}

function b64(state: BoardState) {
  return Buffer.from(serialize(state), 'utf-8').toString('base64')
}

function decodePutContent(body: Record<string, unknown> | undefined) {
  return Buffer.from(body?.content as string, 'base64').toString('utf-8')
}

function adapter() {
  return createGithubAdapter({
    repo: 'owner/repo',
    token: 'token',
    branch: 'main',
    webhookSecret: 'shh',
    publicUrl: 'https://app.example.com',
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createGithubAdapter', () => {
  it('lists .vertical blobs from the tree, named by project, sorted', async () => {
    stub((_method, url) => {
      if (url.includes('/git/trees/')) {
        return {
          body: {
            truncated: false,
            tree: [
              { type: 'blob', path: 'g.vertical', sha: 'sha-g' },
              { type: 'tree', path: 'dir', sha: 'sha-dir' },
              { type: 'blob', path: 'notes.txt', sha: 'sha-txt' },
              { type: 'blob', path: 'dir/a.vertical', sha: 'sha-a' },
            ],
          },
        }
      }
      if (url.includes('/git/blobs/sha-g')) {
        return {
          body: {
            content: b64(createBlankProject('Gamma')),
            encoding: 'base64',
          },
        }
      }
      if (url.includes('/git/blobs/sha-a')) {
        return {
          body: {
            content: b64(createBlankProject('Alpha')),
            encoding: 'base64',
          },
        }
      }
    })

    expect(await adapter().listBoards()).toEqual([
      { id: 'dir/a.vertical', name: 'Alpha' },
      { id: 'g.vertical', name: 'Gamma' },
    ])
  })

  it('throws when the tree is truncated', async () => {
    stub((_method, url) => {
      if (url.includes('/git/trees/'))
        return { body: { truncated: true, tree: [] } }
    })
    await expect(adapter().listBoards()).rejects.toThrow('truncated')
  })

  it('loads a board from inline contents, revision is the blob sha', async () => {
    const state = createBlankProject('Demo')
    stub((_method, url) => {
      if (url.includes('/contents/demo.vertical')) {
        return {
          body: { sha: 'sha-1', content: b64(state), encoding: 'base64' },
        }
      }
    })

    const loaded = await adapter().loadBoard('demo.vertical')
    expect(loaded.revision).toBe('sha-1')
    expect(loaded.state.project.name).toBe('Demo')
  })

  it('applies an action against the latest revision and commits it', async () => {
    const seed = createBlankProject('Demo')
    const layerId = seed.layers[0].id
    const calls = stub((method, url) => {
      if (method === 'GET' && url.includes('/contents/demo.vertical')) {
        return {
          body: { sha: 'sha-1', content: b64(seed), encoding: 'base64' },
        }
      }
      if (method === 'PUT' && url.includes('/contents/demo.vertical')) {
        return { body: { content: { sha: 'sha-2' } } }
      }
    })

    const outcome = await adapter().applyAction(
      'demo.vertical',
      { type: 'CREATE_TASK', id: 'task-a', layerId, name: 'A', sorting: 1 },
      'sha-1'
    )

    expect(outcome.status).toBe('applied')
    expect(outcome.revision).toBe('sha-2')
    expect(outcome.state.tasks.map((t) => t.id)).toEqual(['task-a'])

    const put = calls.find((c) => c.method === 'PUT')
    expect(put?.body?.sha).toBe('sha-1')
    expect(put?.body?.branch).toBe('main')
  })

  it('retries the commit when GitHub reports a stale-write 409', async () => {
    const seed = createBlankProject('Demo')
    const layerId = seed.layers[0].id
    let puts = 0
    stub((method, url) => {
      if (method === 'GET' && url.includes('/contents/demo.vertical')) {
        return {
          body: { sha: 'sha-1', content: b64(seed), encoding: 'base64' },
        }
      }
      if (method === 'PUT' && url.includes('/contents/demo.vertical')) {
        puts++
        if (puts === 1)
          return { status: 409, body: { message: 'sha mismatch' } }
        return { body: { content: { sha: 'sha-2' } } }
      }
    })

    const outcome = await adapter().applyAction(
      'demo.vertical',
      { type: 'CREATE_TASK', id: 'task-a', layerId, name: 'A', sorting: 1 },
      'sha-1'
    )

    expect(puts).toBe(2)
    expect(outcome.status).toBe('applied')
    expect(outcome.revision).toBe('sha-2')
  })

  it('rejects a conflicting edit detected against the base blob', async () => {
    const seed = createBlankProject('Demo')
    const withTask = boardReducer(seed, {
      type: 'CREATE_TASK',
      id: 'task-x',
      layerId: seed.layers[0].id,
      name: 'First',
      sorting: 1,
    })
    const latest = boardReducer(withTask, {
      type: 'RENAME_TASK',
      taskId: 'task-x',
      name: 'Latest',
    })

    const calls = stub((method, url) => {
      if (method === 'GET' && url.includes('/contents/demo.vertical')) {
        return {
          body: { sha: 'sha-latest', content: b64(latest), encoding: 'base64' },
        }
      }
      if (url.includes('/git/blobs/sha-base')) {
        return { body: { content: b64(withTask), encoding: 'base64' } }
      }
    })

    const outcome = await adapter().applyAction(
      'demo.vertical',
      { type: 'RENAME_TASK', taskId: 'task-x', name: 'Mine' },
      'sha-base'
    )

    expect(outcome.status).toBe('rejected')
    expect(outcome.revision).toBe('sha-latest')
    expect(outcome.state.tasks.find((t) => t.id === 'task-x')?.name).toBe(
      'Latest'
    )
    expect(calls.some((c) => c.method === 'PUT')).toBe(false)
  })

  it('creates a board, disambiguating the path on collision', async () => {
    const calls = stub((method, url) => {
      if (url.includes('/git/trees/')) {
        return {
          body: {
            truncated: false,
            tree: [{ type: 'blob', path: 'demo.vertical', sha: 'sha-d' }],
          },
        }
      }
      if (method === 'PUT' && url.includes('/contents/demo-2.vertical')) {
        return { body: { content: { sha: 'sha-new' } } }
      }
    })

    const created = await adapter().createBoard('Demo')
    expect(created).toEqual({ id: 'demo-2.vertical', name: 'Demo' })
    expect(
      calls.some((c) => c.method === 'PUT' && c.url.includes('demo-2.vertical'))
    ).toBe(true)
  })

  it('renames a board in place, keeping the file path', async () => {
    const state = createBlankProject('Old')
    let putContent = ''
    const calls = stub((method, url, body) => {
      if (method === 'GET' && url.includes('/contents/demo.vertical')) {
        return {
          body: { sha: 'sha-1', content: b64(state), encoding: 'base64' },
        }
      }
      if (method === 'PUT' && url.includes('/contents/demo.vertical')) {
        putContent = decodePutContent(body)
        return { body: { content: { sha: 'sha-2' } } }
      }
    })

    const renamed = await adapter().renameBoard('demo.vertical', 'New')
    expect(renamed).toEqual({ id: 'demo.vertical', name: 'New' })
    expect(putContent).toContain('New')
    expect(calls.find((c) => c.method === 'PUT')?.body?.sha).toBe('sha-1')
  })

  it('deletes a board using its current sha', async () => {
    const calls = stub((method, url) => {
      if (method === 'GET' && url.includes('/contents/demo.vertical')) {
        return { body: { sha: 'sha-1' } }
      }
      if (method === 'DELETE' && url.includes('/contents/demo.vertical')) {
        return { body: { commit: {} } }
      }
    })

    await adapter().deleteBoard('demo.vertical')
    const del = calls.find((c) => c.method === 'DELETE')
    expect(del?.body?.sha).toBe('sha-1')
  })

  it('maps a 404 to an ENOENT error', async () => {
    stub(() => ({ status: 404, body: { message: 'Not Found' } }))
    await expect(adapter().loadBoard('missing.vertical')).rejects.toMatchObject(
      {
        code: 'ENOENT',
      }
    )
  })

  it('surfaces a clear error when the rate limit is exhausted', async () => {
    stub(() => ({
      status: 403,
      body: { message: 'rate limited' },
      headers: {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': '1700000000',
      },
    }))
    await expect(adapter().loadBoard('demo.vertical')).rejects.toThrow(
      'rate limit'
    )
  })
})

describe('ensureWebhook', () => {
  it('creates the webhook when none exists', async () => {
    const calls = stub((method, url) => {
      if (method === 'GET' && url.endsWith('/hooks')) return { body: [] }
      if (method === 'POST' && url.endsWith('/hooks'))
        return { body: { id: 1 } }
    })

    await adapter().ensureWebhook()
    const post = calls.find((c) => c.method === 'POST')
    expect((post?.body?.config as { url: string }).url).toBe(
      'https://app.example.com/api/webhook/github'
    )
    expect(post?.body?.events).toEqual(['push'])
  })

  it('updates the webhook when the public URL has drifted', async () => {
    const calls = stub((method, url) => {
      if (method === 'GET' && url.endsWith('/hooks')) {
        return {
          body: [
            {
              id: 42,
              config: { url: 'https://old.example.com/api/webhook/github' },
            },
          ],
        }
      }
      if (method === 'PATCH' && url.endsWith('/hooks/42'))
        return { body: { id: 42 } }
    })

    await adapter().ensureWebhook()
    const patch = calls.find((c) => c.method === 'PATCH')
    expect((patch?.body?.config as { url: string }).url).toBe(
      'https://app.example.com/api/webhook/github'
    )
  })

  it('does nothing when the webhook is already correct', async () => {
    const calls = stub((method, url) => {
      if (method === 'GET' && url.endsWith('/hooks')) {
        return {
          body: [
            {
              id: 7,
              config: { url: 'https://app.example.com/api/webhook/github' },
            },
          ],
        }
      }
    })

    await adapter().ensureWebhook()
    expect(calls.every((c) => c.method === 'GET')).toBe(true)
  })

  it('requires a public URL', async () => {
    const noUrl = createGithubAdapter({
      repo: 'owner/repo',
      token: 'token',
      branch: 'main',
    })
    await expect(noUrl.ensureWebhook()).rejects.toThrow('PUBLIC_URL')
  })
})

describe('handleWebhook', () => {
  function sign(body: string) {
    const digest = crypto.createHmac('sha256', 'shh').update(body).digest('hex')
    return `sha256=${digest}`
  }

  it('answers a ping', async () => {
    stub(() => ({ status: 200, body: null }))
    const body = JSON.stringify({ zen: 'hi' })
    const result = await adapter().handleWebhook({
      headers: { 'x-github-event': 'ping', 'x-hub-signature-256': sign(body) },
      body,
    })
    expect(result.status).toBe(200)
  })

  it('emits a change event for each modified board on push', async () => {
    const calls = stub((method, url) => {
      if (method === 'GET' && url.includes('/contents/a.vertical')) {
        return { body: { sha: 'sha-new' } }
      }
    })
    const board = adapter()
    const events: Array<{ boardId: string; revision: string }> = []
    board.subscribe((event) => events.push(event))

    const body = JSON.stringify({
      commits: [
        { added: [], modified: ['a.vertical'], removed: ['ignore.txt'] },
      ],
    })
    const result = await board.handleWebhook({
      headers: { 'x-github-event': 'push', 'x-hub-signature-256': sign(body) },
      body,
    })

    expect(result.status).toBe(200)
    expect(events).toEqual([{ boardId: 'a.vertical', revision: 'sha-new' }])
    expect(calls.some((c) => c.url.includes('/contents/a.vertical'))).toBe(true)
  })

  it('rejects a payload with an invalid signature', async () => {
    stub(() => ({ status: 200, body: null }))
    const body = JSON.stringify({ commits: [] })
    const result = await adapter().handleWebhook({
      headers: {
        'x-github-event': 'push',
        'x-hub-signature-256': 'sha256=bad',
      },
      body,
    })
    expect(result.status).toBe(401)
  })
})
