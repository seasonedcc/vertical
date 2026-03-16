import { deserialize, serialize } from '~/file/format'
import type { BoardState } from '~/state/types'

async function fetchProject(): Promise<BoardState> {
  const response = await fetch('/api/project')
  if (!response.ok) {
    throw new Error(`Failed to load project: ${response.statusText}`)
  }
  const json = await response.text()
  return deserialize(json)
}

async function saveProject(state: BoardState): Promise<void> {
  const response = await fetch('/api/project', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: serialize(state),
  })
  if (!response.ok) {
    throw new Error(`Failed to save project: ${response.statusText}`)
  }
}

function reportDirty(dirty: boolean): void {
  fetch('/api/dirty', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dirty }),
  })
}

function subscribeToFileChanges(onChanged: () => void): () => void {
  const source = new EventSource('/api/events')
  source.onmessage = (event) => {
    if (event.data === 'file-changed') {
      onChanged()
    }
  }
  return () => source.close()
}

export { fetchProject, reportDirty, saveProject, subscribeToFileChanges }
