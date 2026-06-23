import crypto from 'node:crypto'
import { deserialize, serialize } from '~/file/format'
import type { BoardAction } from '~/state/actions'
import { createBlankProject } from '~/state/initial-state'
import { boardReducer } from '~/state/reducer'
import type { BoardState } from '~/state/types'
import {
  BaseUnavailableError,
  StaleWriteError,
  applyActionWith,
} from './types.js'
import type {
  ApplyOutcome,
  BoardSummary,
  ChangeListener,
  LoadedBoard,
  StorageAdapter,
  WebhookRequest,
  WebhookResponse,
} from './types.js'

type GithubConfig = {
  repo: string
  token: string
  branch?: string
  webhookSecret?: string
  publicUrl?: string
}

type GithubAdapter = StorageAdapter & {
  handleWebhook(request: WebhookRequest): Promise<WebhookResponse>
  ensureWebhook(): Promise<void>
}

const API = 'https://api.github.com'
const WEBHOOK_PATH = '/api/webhook/github'
const CACHE_LIMIT = 200

class GithubError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'GithubError'
    this.status = status
  }
}

function encodePath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/')
}

function header(headers: WebhookRequest['headers'], name: string) {
  const value = headers[name]
  return Array.isArray(value) ? value[0] : value
}

function verifySignature(body: string, signature: string, secret: string) {
  const digest = crypto.createHmac('sha256', secret).update(body).digest('hex')
  const expected = Buffer.from(`sha256=${digest}`)
  const received = Buffer.from(signature)
  if (expected.length !== received.length) return false
  return crypto.timingSafeEqual(expected, received)
}

function changedVerticalPaths(payload: {
  commits?: Array<{ added?: string[]; modified?: string[]; removed?: string[] }>
}) {
  const paths = new Set<string>()
  for (const commit of payload.commits ?? []) {
    for (const path of [
      ...(commit.added ?? []),
      ...(commit.modified ?? []),
      ...(commit.removed ?? []),
    ]) {
      if (path.endsWith('.vertical')) paths.add(path)
    }
  }
  return [...paths]
}

function createGithubAdapter(config: GithubConfig): GithubAdapter {
  const [owner, repo] = config.repo.split('/')
  if (!owner || !repo) {
    throw new Error(
      `Invalid GitHub repo: "${config.repo}" (expected owner/repo)`
    )
  }

  const listeners = new Set<ChangeListener>()
  const stateCache = new Map<string, BoardState>()
  let branch = config.branch

  function remember(revision: string, state: BoardState) {
    stateCache.set(revision, state)
    if (stateCache.size > CACHE_LIMIT) {
      const oldest = stateCache.keys().next().value
      if (oldest !== undefined) stateCache.delete(oldest)
    }
  }

  async function githubRequest(method: string, path: string, body?: unknown) {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const text = await response.text()
    const data = text ? JSON.parse(text) : null

    if (!response.ok) {
      if (
        response.status === 403 &&
        response.headers.get('x-ratelimit-remaining') === '0'
      ) {
        const reset = response.headers.get('x-ratelimit-reset')
        const at = reset
          ? ` (resets at ${new Date(Number(reset) * 1000).toISOString()})`
          : ''
        throw new GithubError(403, `GitHub rate limit exceeded${at}`)
      }
      const message = data?.message ?? response.statusText
      const error = new GithubError(
        response.status,
        `GitHub ${method} ${path} failed: ${message}`
      )
      if (response.status === 404) {
        ;(error as NodeJS.ErrnoException).code = 'ENOENT'
      }
      throw error
    }

    return data
  }

  async function getBranch() {
    if (branch) return branch
    const info = await githubRequest('GET', `/repos/${owner}/${repo}`)
    branch = info.default_branch
    return branch as string
  }

  async function getContents(id: string) {
    const ref = await getBranch()
    return githubRequest(
      'GET',
      `/repos/${owner}/${repo}/contents/${encodePath(id)}?ref=${encodeURIComponent(ref)}`
    )
  }

  async function readBlob(sha: string) {
    const cached = stateCache.get(sha)
    if (cached) return cached
    const blob = await githubRequest(
      'GET',
      `/repos/${owner}/${repo}/git/blobs/${sha}`
    )
    const content = Buffer.from(blob.content, blob.encoding).toString('utf-8')
    const state = deserialize(content)
    remember(sha, state)
    return state
  }

  async function listTree() {
    const ref = await getBranch()
    const tree = await githubRequest(
      'GET',
      `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`
    )
    if (tree.truncated) {
      throw new Error('GitHub repository tree is too large to list (truncated)')
    }
    return (tree.tree ?? []).filter(
      (entry: { type: string; path: string }) =>
        entry.type === 'blob' && entry.path.endsWith('.vertical')
    ) as Array<{ path: string; sha: string }>
  }

  async function listBoards(): Promise<BoardSummary[]> {
    const entries = await listTree()
    const summaries = await Promise.all(
      entries.map(async (entry) => {
        const state = await readBlob(entry.sha)
        return { id: entry.path, name: state.project.name }
      })
    )
    return summaries.sort((a, b) => a.name.localeCompare(b.name))
  }

  async function loadBoard(id: string): Promise<LoadedBoard> {
    const meta = await getContents(id)
    const revision = meta.sha as string
    let state = stateCache.get(revision)
    if (!state) {
      if (meta.content && meta.encoding === 'base64') {
        state = deserialize(
          Buffer.from(meta.content, 'base64').toString('utf-8')
        )
        remember(revision, state)
      } else {
        state = await readBlob(revision)
      }
    }
    return { state, revision }
  }

  async function persist(
    id: string,
    state: BoardState,
    expectedRevision: string
  ) {
    const ref = await getBranch()
    try {
      const result = await githubRequest(
        'PUT',
        `/repos/${owner}/${repo}/contents/${encodePath(id)}`,
        {
          message: `Update ${id}`,
          content: Buffer.from(serialize(state), 'utf-8').toString('base64'),
          sha: expectedRevision,
          branch: ref,
        }
      )
      const revision = result.content.sha as string
      remember(revision, state)
      return revision
    } catch (error) {
      if (error instanceof GithubError && error.status === 409) {
        throw new StaleWriteError()
      }
      throw error
    }
  }

  async function applyAction(
    id: string,
    action: BoardAction,
    baseRevision: string
  ): Promise<ApplyOutcome> {
    return applyActionWith(
      {
        load: () => loadBoard(id),
        loadBase: async (revision) => {
          try {
            return await readBlob(revision)
          } catch (error) {
            if (
              error instanceof GithubError &&
              (error.status === 404 || error.status === 422)
            ) {
              throw new BaseUnavailableError(revision)
            }
            throw error
          }
        },
        persist: (state, expectedRevision) =>
          persist(id, state, expectedRevision),
      },
      action,
      baseRevision
    )
  }

  async function uniquePath(name: string) {
    const slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'project'
    const existing = new Set((await listTree()).map((entry) => entry.path))
    let candidate = `${slug}.vertical`
    let counter = 2
    while (existing.has(candidate)) {
      candidate = `${slug}-${counter}.vertical`
      counter++
    }
    return candidate
  }

  async function createBoard(name: string): Promise<BoardSummary> {
    const ref = await getBranch()
    const id = await uniquePath(name)
    const state = createBlankProject(name)
    const result = await githubRequest(
      'PUT',
      `/repos/${owner}/${repo}/contents/${encodePath(id)}`,
      {
        message: `Create ${id}`,
        content: Buffer.from(serialize(state), 'utf-8').toString('base64'),
        branch: ref,
      }
    )
    remember(result.content.sha, state)
    return { id, name: state.project.name }
  }

  async function renameBoard(id: string, name: string): Promise<BoardSummary> {
    const { state, revision } = await loadBoard(id)
    const next = boardReducer(state, { type: 'RENAME_PROJECT', name })
    await persist(id, next, revision)
    return { id, name: next.project.name }
  }

  async function deleteBoard(id: string): Promise<void> {
    const ref = await getBranch()
    const meta = await getContents(id)
    await githubRequest(
      'DELETE',
      `/repos/${owner}/${repo}/contents/${encodePath(id)}`,
      { message: `Delete ${id}`, sha: meta.sha, branch: ref }
    )
  }

  function subscribe(listener: ChangeListener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  function emit(boardId: string, revision: string) {
    for (const listener of listeners) listener({ boardId, revision })
  }

  async function handleWebhook(
    request: WebhookRequest
  ): Promise<WebhookResponse> {
    if (config.webhookSecret) {
      const signature = header(request.headers, 'x-hub-signature-256')
      if (
        !signature ||
        !verifySignature(request.body, signature, config.webhookSecret)
      ) {
        return { status: 401, body: { error: 'Invalid signature' } }
      }
    }

    const event = header(request.headers, 'x-github-event')
    if (event === 'ping') return { status: 200, body: { ok: true } }
    if (event !== 'push') return { status: 200, body: { ignored: event } }

    const payload = JSON.parse(request.body)
    const paths = changedVerticalPaths(payload)
    await Promise.all(
      paths.map(async (path) => {
        let revision = ''
        try {
          const meta = await getContents(path)
          revision = meta.sha
        } catch {
          revision = ''
        }
        emit(path, revision)
      })
    )
    return { status: 200, body: { ok: true } }
  }

  async function ensureWebhook(): Promise<void> {
    if (!config.publicUrl) {
      throw new Error(
        'PUBLIC_URL is required to register the GitHub webhook (no polling fallback)'
      )
    }
    const desiredUrl = `${config.publicUrl.replace(/\/$/, '')}${WEBHOOK_PATH}`
    const hooks = await githubRequest('GET', `/repos/${owner}/${repo}/hooks`)
    const existing = (hooks ?? []).find(
      (hook: { config?: { url?: string } }) =>
        typeof hook.config?.url === 'string' &&
        hook.config.url.endsWith(WEBHOOK_PATH)
    )
    const hookConfig = {
      url: desiredUrl,
      content_type: 'json',
      secret: config.webhookSecret,
      insecure_ssl: '0',
    }

    if (!existing) {
      await githubRequest('POST', `/repos/${owner}/${repo}/hooks`, {
        name: 'web',
        active: true,
        events: ['push'],
        config: hookConfig,
      })
    } else if (existing.config.url !== desiredUrl) {
      await githubRequest(
        'PATCH',
        `/repos/${owner}/${repo}/hooks/${existing.id}`,
        {
          active: true,
          events: ['push'],
          config: hookConfig,
        }
      )
    }
  }

  return {
    listBoards,
    loadBoard,
    applyAction,
    createBoard,
    renameBoard,
    deleteBoard,
    subscribe,
    handleWebhook,
    ensureWebhook,
  }
}

export { createGithubAdapter, GithubError }
export type { GithubAdapter, GithubConfig }
