import { deserialize } from '~/file/format'
import type { BoardAction } from '~/state/actions'
import type { BoardState } from '~/state/types'

async function fetchProject(): Promise<BoardState> {
  const response = await fetch('/api/project')
  if (!response.ok) {
    throw new Error(`Failed to load project: ${response.statusText}`)
  }
  const json = await response.text()
  return deserialize(json)
}

async function saveActions(actions: BoardAction[]): Promise<BoardState> {
  const response = await fetch('/api/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actions }),
  })
  if (!response.ok) {
    throw new Error(`Failed to save project: ${response.statusText}`)
  }
  return deserialize(await response.text())
}

function reportDirty(dirty: boolean): void {
  fetch('/api/dirty', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dirty }),
  })
}

function subscribeToServer(
  onFileChanged: () => void,
  onDisconnected: () => void
): () => void {
  const source = new EventSource('/api/events')
  source.onmessage = (event) => {
    if (event.data === 'file-changed') {
      onFileChanged()
    }
  }
  source.onerror = () => {
    source.close()
    onDisconnected()
  }
  return () => source.close()
}

export { fetchProject, reportDirty, saveActions, subscribeToServer }
