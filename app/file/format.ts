import type { BoardEvent, BoardState, Task } from '~/state/types'

type VerticalFile = {
  version: 1
  project: BoardState['project']
  slices: BoardState['slices']
  layers: BoardState['layers']
  tasks: Array<
    Pick<Task, 'id' | 'projectId' | 'layerId' | 'name' | 'sorting' | 'done'> &
      Partial<Task>
  >
  events?: BoardEvent[]
}

function serialize(state: BoardState, events: BoardEvent[] = []): string {
  const file: VerticalFile = {
    version: 1,
    project: state.project,
    slices: state.slices,
    layers: state.layers,
    tasks: state.tasks,
    ...(events.length > 0 ? { events } : {}),
  }
  return JSON.stringify(file, null, 2)
}

function deserializeEvents(json: string): BoardEvent[] {
  const file = JSON.parse(json) as VerticalFile
  return file.events ?? []
}

function deserialize(json: string): BoardState {
  const file = JSON.parse(json) as VerticalFile

  if (file.version !== 1) {
    throw new Error(`Unsupported file version: ${file.version}`)
  }

  if (!file.project || !file.slices || !file.layers || !file.tasks) {
    throw new Error('Invalid .vertical file: missing required fields')
  }

  return {
    project: file.project,
    slices: file.slices,
    layers: file.layers,
    tasks: file.tasks.map((t) => ({
      ...t,
      notesHtml: t.notesHtml ?? null,
      status: t.status ?? null,
      statusReason: t.statusReason ?? null,
      assignee: t.assignee ?? null,
      blockedBy: t.blockedBy ?? [],
      links: t.links ?? [],
      needsPickup: t.needsPickup ?? false,
    })),
  }
}

export { deserialize, deserializeEvents, serialize }
