type ChangeKind =
  | 'project-created'
  | 'project-renamed'
  | 'slice-named'
  | 'slice-renamed'
  | 'slice-unnamed'
  | 'task-added'
  | 'task-removed'
  | 'task-completed'
  | 'task-uncompleted'
  | 'task-renamed'
  | 'task-moved'
  | 'layer-closed'
  | 'layer-reopened'
  | 'layer-renamed'

type ActivityChange = {
  kind: ChangeKind
  text: string
  taskId?: string
  sliceId?: string
  layerId?: string
}

type ActivityEvent = {
  hash: string
  author: string
  email: string
  timestamp: string
  subject: string
  changes: ActivityChange[]
}

type ActivityResponse =
  | { available: true; events: ActivityEvent[] }
  | { available: false; reason: string }

export type { ActivityChange, ActivityEvent, ActivityResponse, ChangeKind }
