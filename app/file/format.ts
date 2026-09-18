import type { BoardEvent, BoardState } from '~/state/types'
import { CURRENT_VERSION, type RawFile, migrate } from './migrations'

type VerticalFile = {
  version: typeof CURRENT_VERSION
  project: BoardState['project']
  slices: BoardState['slices']
  layers: BoardState['layers']
  tasks: BoardState['tasks']
  events: BoardEvent[]
}

function serialize(state: BoardState, events: BoardEvent[] = []): string {
  const file: VerticalFile = {
    version: CURRENT_VERSION,
    project: state.project,
    slices: state.slices,
    layers: state.layers,
    tasks: state.tasks,
    events,
  }
  return JSON.stringify(file, null, 2)
}

function parse(json: string) {
  const raw = JSON.parse(json) as RawFile

  if (!raw.project || !raw.slices || !raw.layers || !raw.tasks) {
    throw new Error('Invalid .vertical file: missing required fields')
  }

  return migrate(raw) as unknown as VerticalFile
}

function fileVersion(json: string) {
  return (JSON.parse(json) as RawFile).version
}

function deserializeEvents(json: string): BoardEvent[] {
  return parse(json).events
}

function deserialize(json: string): BoardState {
  const file = parse(json)
  return {
    project: file.project,
    slices: file.slices,
    layers: file.layers,
    tasks: file.tasks,
  }
}

export { deserialize, deserializeEvents, fileVersion, serialize }
