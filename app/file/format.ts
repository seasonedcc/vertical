import type { BoardState, Task } from '~/state/types'

type VerticalFile = {
  version: 1
  project: BoardState['project']
  slices: BoardState['slices']
  layers: BoardState['layers']
  tasks: Array<Omit<Task, 'notesHtml'> & { notesHtml?: string | null }>
}

function serialize(state: BoardState): string {
  const file: VerticalFile = {
    version: 1,
    project: state.project,
    slices: state.slices,
    layers: state.layers,
    tasks: state.tasks,
  }
  return JSON.stringify(file, null, 2)
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
    tasks: file.tasks.map((t) => ({ ...t, notesHtml: t.notesHtml ?? null })),
  }
}

export { deserialize, serialize }
