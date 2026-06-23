import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
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
} from './types.js'

const CACHE_LIMIT = 200

function createLocalAdapter(rootDir: string): StorageAdapter {
  const root = path.resolve(rootDir)
  const cache = new Map<string, BoardState>()

  function remember(revision: string, state: BoardState) {
    cache.set(revision, state)
    if (cache.size > CACHE_LIMIT) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) cache.delete(oldest)
    }
  }

  function resolvePath(id: string) {
    const full = path.resolve(root, id)
    if (full !== root && !full.startsWith(root + path.sep)) {
      throw new Error(`Invalid board id: ${id}`)
    }
    return full
  }

  function revisionOf(content: string) {
    return crypto.createHash('sha1').update(content).digest('hex')
  }

  function readBoard(id: string): LoadedBoard {
    const content = fs.readFileSync(resolvePath(id), 'utf-8')
    const state = deserialize(content)
    const revision = revisionOf(content)
    remember(revision, state)
    return { state, revision }
  }

  function persistState(id: string, state: BoardState) {
    const content = serialize(state)
    fs.writeFileSync(resolvePath(id), content)
    const revision = revisionOf(content)
    remember(revision, state)
    return revision
  }

  function listVerticalFiles(dir: string, prefix = ''): string[] {
    const results: string[] = []
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        results.push(...listVerticalFiles(path.join(dir, entry.name), relative))
      } else if (entry.isFile() && entry.name.endsWith('.vertical')) {
        results.push(relative)
      }
    }
    return results
  }

  function uniqueId(name: string) {
    const slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'project'
    let candidate = `${slug}.vertical`
    let counter = 2
    while (fs.existsSync(path.join(root, candidate))) {
      candidate = `${slug}-${counter}.vertical`
      counter++
    }
    return candidate
  }

  async function listBoards(): Promise<BoardSummary[]> {
    if (!fs.existsSync(root)) return []
    return listVerticalFiles(root)
      .map((id) => ({ id, name: readBoard(id).state.project.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async function loadBoard(id: string): Promise<LoadedBoard> {
    return readBoard(id)
  }

  async function applyAction(
    id: string,
    action: BoardAction,
    baseRevision: string
  ): Promise<ApplyOutcome> {
    return applyActionWith(
      {
        load: async () => readBoard(id),
        loadBase: async (revision) => {
          const state = cache.get(revision)
          if (!state) throw new BaseUnavailableError(revision)
          return state
        },
        persist: async (state, expectedRevision) => {
          const current = revisionOf(fs.readFileSync(resolvePath(id), 'utf-8'))
          if (current !== expectedRevision) throw new StaleWriteError()
          return persistState(id, state)
        },
      },
      action,
      baseRevision
    )
  }

  async function createBoard(name: string): Promise<BoardSummary> {
    fs.mkdirSync(root, { recursive: true })
    const id = uniqueId(name)
    const state = createBlankProject(name)
    persistState(id, state)
    return { id, name: state.project.name }
  }

  async function renameBoard(id: string, name: string): Promise<BoardSummary> {
    const { state } = readBoard(id)
    const next = boardReducer(state, { type: 'RENAME_PROJECT', name })
    persistState(id, next)
    return { id, name: next.project.name }
  }

  async function deleteBoard(id: string): Promise<void> {
    fs.rmSync(resolvePath(id))
  }

  function subscribe(listener: ChangeListener): () => void {
    const handler = (_event: fs.WatchEventType, filename: string | null) => {
      if (!filename) return
      const id = filename.split(path.sep).join('/')
      if (!id.endsWith('.vertical')) return
      try {
        listener({ boardId: id, revision: readBoard(id).revision })
      } catch {
        listener({ boardId: id, revision: '' })
      }
    }

    let watcher: fs.FSWatcher
    try {
      watcher = fs.watch(root, { recursive: true }, handler)
    } catch {
      watcher = fs.watch(root, handler)
    }
    return () => watcher.close()
  }

  return {
    listBoards,
    loadBoard,
    applyAction,
    createBoard,
    renameBoard,
    deleteBoard,
    subscribe,
  }
}

export { createLocalAdapter }
