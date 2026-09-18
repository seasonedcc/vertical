const CURRENT_VERSION = 2

type RawFile = { version: number } & Record<string, unknown>
type RawTask = Record<string, unknown>

const migrations: Record<number, (file: RawFile) => RawFile> = {
  1: (file) => ({
    ...file,
    version: 2,
    tasks: ((file.tasks as RawTask[] | undefined) ?? []).map((task) => ({
      ...task,
      notesHtml: task.notesHtml ?? null,
      status: null,
      statusReason: null,
      assignee: null,
      blockedBy: [],
      links: [],
      needsPickup: false,
    })),
    events: [],
  }),
}

function migrate(file: RawFile): RawFile {
  if (!Number.isInteger(file.version) || file.version < 1) {
    throw new Error(`Unsupported file version: ${file.version}`)
  }
  if (file.version > CURRENT_VERSION) {
    throw new Error(
      `This file is version ${file.version}, and this Vertical reads up to version ${CURRENT_VERSION}. Update with: itsvertical update`
    )
  }

  let current = file
  while (current.version < CURRENT_VERSION) {
    current = migrations[current.version](current)
  }
  return current
}

export { CURRENT_VERSION, migrate }
export type { RawFile }
