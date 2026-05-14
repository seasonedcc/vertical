import type { ActivityResponse } from '~/file/activity-types'
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

async function fetchActivity(): Promise<ActivityResponse> {
  const response = await fetch('/api/activity')
  if (!response.ok) {
    throw new Error(`Failed to load activity: ${response.statusText}`)
  }
  return response.json()
}

export {
  fetchActivity,
  fetchProject,
  reportDirty,
  saveProject,
  subscribeToServer,
}
