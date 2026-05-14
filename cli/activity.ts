import { spawnSync } from 'node:child_process'
import path from 'node:path'
import type {
  ActivityChange,
  ActivityEvent,
  ActivityResponse,
} from '~/file/activity-types'
import { deserialize } from '~/file/format'
import type { BoardState, Layer, Task } from '~/state/types'

type GitOk = { ok: true; stdout: string }
type GitErr = { ok: false; reason: string }

function git(args: string[], cwd: string): GitOk | GitErr {
  const result = spawnSync('git', args, { cwd, encoding: 'utf-8' })
  if (result.error) {
    return { ok: false, reason: 'git is not installed or not on PATH' }
  }
  if (result.status !== 0) {
    return { ok: false, reason: (result.stderr || '').trim() }
  }
  return { ok: true, stdout: result.stdout }
}

function fileAtCommit(
  hash: string,
  relPath: string,
  repoRoot: string
): BoardState | null {
  const result = git(['show', `${hash}:${relPath}`], repoRoot)
  if (!result.ok) return null
  try {
    return deserialize(result.stdout)
  } catch {
    return null
  }
}

function indexBy<T extends { id: string }>(list: T[]): Map<string, T> {
  const map = new Map<string, T>()
  for (const item of list) map.set(item.id, item)
  return map
}

function describeTaskLocation(task: Task, state: BoardState): string {
  const layer = state.layers.find((l) => l.id === task.layerId)
  if (!layer) return ''
  const slice = state.slices.find((s) => s.id === layer.sliceId)
  if (!slice) return ''
  return slice.name ?? `Box ${slice.boxNumber}`
}

function describeLayer(layer: Layer, state: BoardState): string {
  const slice = state.slices.find((s) => s.id === layer.sliceId)
  const sliceLabel = slice
    ? (slice.name ?? `Box ${slice.boxNumber}`)
    : 'unknown box'
  return layer.name ? `${layer.name} (${sliceLabel})` : sliceLabel
}

function diffStates(
  before: BoardState | null,
  after: BoardState
): ActivityChange[] {
  const changes: ActivityChange[] = []

  if (!before) {
    changes.push({
      kind: 'project-created',
      text: `Created project "${after.project.name}"`,
    })
    for (const slice of after.slices) {
      if (slice.name) {
        changes.push({
          kind: 'slice-named',
          text: `Named box ${slice.boxNumber}: ${slice.name}`,
          sliceId: slice.id,
        })
      }
    }
    for (const task of after.tasks) {
      changes.push({
        kind: task.done ? 'task-completed' : 'task-added',
        text: task.name,
        taskId: task.id,
      })
    }
    for (const layer of after.layers) {
      if (layer.status === 'done') {
        changes.push({
          kind: 'layer-closed',
          text: `Closed layer in ${describeLayer(layer, after)}`,
          layerId: layer.id,
        })
      }
    }
    return changes
  }

  if (before.project.name !== after.project.name) {
    changes.push({
      kind: 'project-renamed',
      text: `Renamed project: "${before.project.name}" → "${after.project.name}"`,
    })
  }

  const beforeSlices = indexBy(before.slices)
  for (const slice of after.slices) {
    const prev = beforeSlices.get(slice.id)
    if (!prev) continue
    if (prev.name === slice.name) continue
    if (prev.name === null && slice.name !== null) {
      changes.push({
        kind: 'slice-named',
        text: `Named box ${slice.boxNumber}: ${slice.name}`,
        sliceId: slice.id,
      })
    } else if (prev.name !== null && slice.name === null) {
      changes.push({
        kind: 'slice-unnamed',
        text: `Cleared name of box ${slice.boxNumber} (was "${prev.name}")`,
        sliceId: slice.id,
      })
    } else if (prev.name !== null && slice.name !== null) {
      changes.push({
        kind: 'slice-renamed',
        text: `Renamed box ${slice.boxNumber}: "${prev.name}" → "${slice.name}"`,
        sliceId: slice.id,
      })
    }
  }

  const beforeLayers = indexBy(before.layers)
  for (const layer of after.layers) {
    const prev = beforeLayers.get(layer.id)
    if (!prev) continue
    if (prev.name !== layer.name) {
      if (layer.name) {
        changes.push({
          kind: 'layer-renamed',
          text: prev.name
            ? `Renamed layer: "${prev.name}" → "${layer.name}"`
            : `Named layer: "${layer.name}"`,
          layerId: layer.id,
        })
      }
    }
    if (prev.status !== layer.status) {
      if (layer.status === 'done') {
        changes.push({
          kind: 'layer-closed',
          text: `Closed layer in ${describeLayer(layer, after)}`,
          layerId: layer.id,
        })
      } else {
        changes.push({
          kind: 'layer-reopened',
          text: `Reopened layer in ${describeLayer(layer, after)}`,
          layerId: layer.id,
        })
      }
    }
  }

  const beforeTasks = indexBy(before.tasks)
  const afterTasks = indexBy(after.tasks)

  for (const task of after.tasks) {
    const prev = beforeTasks.get(task.id)
    if (!prev) {
      changes.push({
        kind: task.done ? 'task-completed' : 'task-added',
        text: task.done ? `${task.name} (added as already done)` : task.name,
        taskId: task.id,
      })
      continue
    }
    if (prev.name !== task.name) {
      changes.push({
        kind: 'task-renamed',
        text: `"${prev.name}" → "${task.name}"`,
        taskId: task.id,
      })
    }
    if (prev.done !== task.done) {
      changes.push({
        kind: task.done ? 'task-completed' : 'task-uncompleted',
        text: task.name,
        taskId: task.id,
      })
    }
    if (prev.layerId !== task.layerId) {
      changes.push({
        kind: 'task-moved',
        text: `${task.name} → ${describeTaskLocation(task, after)}`,
        taskId: task.id,
      })
    }
  }

  for (const task of before.tasks) {
    if (!afterTasks.has(task.id)) {
      changes.push({
        kind: 'task-removed',
        text: `Removed task: ${task.name}`,
        taskId: task.id,
      })
    }
  }

  return changes
}

type ActivityOptions = {
  author?: string
  since?: string
  until?: string
  limit?: number
}

function parseCommits(stdout: string) {
  if (!stdout.trim()) return []
  return stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, author, email, timestamp, ...rest] = line.split('\x1f')
      return {
        hash,
        author,
        email,
        timestamp,
        subject: rest.join('\x1f'),
      }
    })
}

function getActivity(
  filePath: string,
  options: ActivityOptions = {}
): ActivityResponse {
  const absoluteFile = path.resolve(filePath)
  const dir = path.dirname(absoluteFile)

  const rootResult = git(['rev-parse', '--show-toplevel'], dir)
  if (!rootResult.ok) {
    return {
      available: false,
      reason: rootResult.reason || 'Not a git repository',
    }
  }
  const repoRoot = rootResult.stdout.trim()
  const relPath = path.relative(repoRoot, absoluteFile)

  const args = [
    'log',
    '--follow',
    '--pretty=format:%H%x1f%an%x1f%ae%x1f%aI%x1f%s',
  ]
  if (options.author) args.push(`--author=${options.author}`)
  if (options.since) args.push(`--since=${options.since}`)
  if (options.until) args.push(`--until=${options.until}`)
  if (options.limit) args.push(`--max-count=${options.limit}`)
  args.push('--', relPath)

  const logResult = git(args, repoRoot)
  if (!logResult.ok) {
    return { available: false, reason: logResult.reason || 'git log failed' }
  }

  const commits = parseCommits(logResult.stdout)

  const events: ActivityEvent[] = []
  for (const commit of commits) {
    const after = fileAtCommit(commit.hash, relPath, repoRoot)
    if (!after) continue
    const before = fileAtCommit(`${commit.hash}^`, relPath, repoRoot)
    const changes = diffStates(before, after)
    if (changes.length === 0) continue
    events.push({
      hash: commit.hash,
      author: commit.author,
      email: commit.email,
      timestamp: commit.timestamp,
      subject: commit.subject,
      changes,
    })
  }

  return { available: true, events }
}

export { diffStates, getActivity }
export type { ActivityOptions }
