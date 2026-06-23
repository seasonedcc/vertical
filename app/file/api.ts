import type { BoardAction } from '~/state/actions'
import type { BoardState } from '~/state/types'

type BoardSummary = { id: string; name: string }
type LoadedBoard = { state: BoardState; revision: string }
type ApplyOutcome = {
  status: 'applied' | 'rejected'
  state: BoardState
  revision: string
}
type ChangeEvent = { boardId: string; revision: string }
type ServerConfig = Record<string, unknown>

async function readJson(response: Response) {
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText)
    throw new Error(message || response.statusText)
  }
  return response.json()
}

function projectPath(id: string) {
  return `/api/projects/${encodeURIComponent(id)}`
}

async function getConfig(): Promise<ServerConfig> {
  return readJson(await fetch('/api/config'))
}

async function listProjects(): Promise<BoardSummary[]> {
  return readJson(await fetch('/api/projects'))
}

async function loadBoard(id: string): Promise<LoadedBoard> {
  return readJson(await fetch(projectPath(id)))
}

async function createProject(name: string): Promise<BoardSummary> {
  return readJson(
    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
  )
}

async function renameProject(id: string, name: string): Promise<BoardSummary> {
  return readJson(
    await fetch(projectPath(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
  )
}

async function deleteProject(id: string): Promise<void> {
  const response = await fetch(projectPath(id), { method: 'DELETE' })
  if (!response.ok) throw new Error(response.statusText)
}

async function applyAction(
  id: string,
  action: BoardAction,
  baseRevision: string
): Promise<ApplyOutcome> {
  return readJson(
    await fetch(`${projectPath(id)}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, baseRevision }),
    })
  )
}

function subscribeToEvents(
  onChange: (event: ChangeEvent) => void,
  onDisconnected: () => void
): () => void {
  const source = new EventSource('/api/events')
  source.onmessage = (event) => {
    if (!event.data) return
    onChange(JSON.parse(event.data))
  }
  source.onerror = () => {
    source.close()
    onDisconnected()
  }
  return () => source.close()
}

export {
  applyAction,
  createProject,
  deleteProject,
  getConfig,
  listProjects,
  loadBoard,
  renameProject,
  subscribeToEvents,
}
export type {
  ApplyOutcome,
  BoardSummary,
  ChangeEvent,
  LoadedBoard,
  ServerConfig,
}
