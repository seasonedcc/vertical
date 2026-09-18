import fs from 'node:fs'
import path from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command } from 'commander'
import { fileVersion, serialize } from '~/file/format'
import { CURRENT_VERSION } from '~/file/migrations'
import { createBlankProject } from '~/state/initial-state'
import type { TaskStatus } from '~/state/types'
import {
  applyAction,
  fail,
  loadEvents,
  loadState,
  output,
  resolveFilePath,
  setActor,
  updateState,
} from './apply.js'
import { showBoardGrid, showSummaryTable } from './board.js'
import { forgetBoard, loadHistory, recordBoard } from './history.js'
import { listInbox } from './inbox.js'
import { applyPlan, parsePlan } from './plan.js'
import { startServer } from './server.js'
import { showBoard, showBoardJson } from './show.js'
import { showSummary, summarizeBoard } from './summary.js'
import {
  checkAndUpdate,
  checkForUpdate,
  getUpdateCommandString,
  performUpdate,
} from './update.js'
import { validateBoard } from './validate.js'

function getDirname() {
  if (typeof __dirname !== 'undefined') return __dirname
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    return dirname(fileURLToPath(import.meta.url))
  }
  throw new Error('Cannot determine directory path in current environment')
}

const packageJson: { version: string } = JSON.parse(
  fs.readFileSync(
    path.resolve(getDirname(), '..', '..', 'package.json'),
    'utf8'
  )
)

type JsonOption = { json?: boolean; brief?: boolean }

function requireTask(filePath: string, taskId: string, json?: boolean) {
  if (!loadState(filePath).tasks.some((t) => t.id === taskId)) {
    fail(`Task not found: ${taskId}`, json)
  }
}

const program = new Command()

program
  .name('itsvertical')
  .description(
    "Tickets pile up, scopes get done. Project work isn't linear, it's Vertical.\n\nTip: itsvertical <file.vertical> is a shorthand for itsvertical open <file>."
  )
  .version(packageJson.version)

program
  .command('new')
  .description('Create a new .vertical project file')
  .argument('<path>', 'File path for the new .vertical file')
  .argument('<name>', 'Project name')
  .option('--no-track', 'Do not record this board in the board history')
  .option('--json', 'Output as JSON')
  .action(
    (
      fileDest: string,
      name: string,
      options: JsonOption & { track: boolean }
    ) => {
      const filePath = path.resolve(fileDest)

      if (fs.existsSync(filePath)) {
        fail(`File already exists: ${filePath}`, options.json)
      }

      if (options.track) {
        try {
          recordBoard(name, filePath)
        } catch (error) {
          fail((error as Error).message, options.json)
        }
      }

      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      const state = createBlankProject(name)
      fs.writeFileSync(filePath, serialize(state))

      output(state, options, `Created: ${filePath}`)
    }
  )

program
  .command('open')
  .description('Open an existing .vertical file in the browser')
  .argument('<file>', 'Path to the .vertical file')
  .option(
    '--inbox',
    'Flag tasks edited in the browser so an agent can pick them up'
  )
  .option('--read-only', 'Serve the board for viewing only')
  .option('--no-track', 'Do not record this board in the board history')
  .action(
    async (
      file: string,
      options: { inbox?: boolean; readOnly?: boolean; track: boolean }
    ) => {
      if (options.inbox && options.readOnly) {
        fail('--inbox and --read-only cannot be combined')
      }
      const filePath = resolveFilePath(file)
      const state = loadState(filePath)
      if (options.track) {
        try {
          recordBoard(state.project.name, filePath)
        } catch (error) {
          console.warn(
            `Warning: could not track board: ${(error as Error).message}`
          )
        }
      }
      await startServer(filePath, {
        inbox: options.inbox,
        readOnly: options.readOnly,
      })
    }
  )

program
  .command('dev')
  .description('Start dev server (fixed port, no browser open)')
  .argument('<file>', 'Path to the .vertical file')
  .option(
    '--inbox',
    'Flag tasks edited in the browser so an agent can pick them up'
  )
  .option('--read-only', 'Serve the board for viewing only')
  .action(
    async (file: string, options: { inbox?: boolean; readOnly?: boolean }) => {
      if (options.inbox && options.readOnly) {
        fail('--inbox and --read-only cannot be combined')
      }
      const filePath = resolveFilePath(file)
      await startServer(filePath, {
        port: 3456,
        open: false,
        inbox: options.inbox,
        readOnly: options.readOnly,
      })
    }
  )

program
  .command('show')
  .description('Print the board to the terminal')
  .argument('<file>', 'Path to the .vertical file')
  .option('--json', 'Output as JSON')
  .option('--box <slice-id>', 'Show only a specific box')
  .option('--visual', 'Show the board as a visual 3x3 grid with summary')
  .option('--summary', 'Show counts per box and layer in a few lines')
  .action(
    (
      file: string,
      options: JsonOption & {
        box?: string
        visual?: boolean
        summary?: boolean
      }
    ) => {
      const filePath = resolveFilePath(file, options.json)
      const state = loadState(filePath)

      if (options.box) {
        const slice = state.slices.find((s) => s.id === options.box)
        if (!slice) {
          fail(`Box not found: ${options.box}`, options.json)
        }
      }

      if (options.summary && options.json) {
        console.log(JSON.stringify(summarizeBoard(state, options.box), null, 2))
      } else if (options.summary) {
        showSummary(state, options.box)
      } else if (options.json) {
        showBoardJson(state)
      } else if (options.visual) {
        showBoardGrid(state, options.box)
        showSummaryTable(state, options.box)
      } else {
        showBoard(state, options.box)
      }
    }
  )

program
  .command('rename')
  .description('Rename the project')
  .argument('<file>', 'Path to the .vertical file')
  .argument('<name>', 'New project name')
  .option('--json', 'Output as JSON')
  .action((file: string, name: string, options: JsonOption) => {
    const filePath = resolveFilePath(file, options.json)
    const state = applyAction(filePath, { type: 'RENAME_PROJECT', name })
    output(state, options, `Project renamed to: ${name}`)
  })

program
  .command('apply')
  .description('Fill empty boxes from a plan file in one call')
  .argument('<file>', 'Path to the .vertical file')
  .argument('<plan>', 'Path to a plan JSON file')
  .option('--json', 'Output as JSON')
  .action((file: string, planFile: string, options: JsonOption) => {
    const filePath = resolveFilePath(file, options.json)
    const planPath = resolveFilePath(planFile, options.json)

    try {
      const plan = parsePlan(fs.readFileSync(planPath, 'utf-8'))
      let created: ReturnType<typeof applyPlan>['created'] = []
      const state = updateState(
        filePath,
        (current) => {
          const result = applyPlan(current, plan, () => crypto.randomUUID())
          created = result.created
          return result.state
        },
        () => [
          {
            summary: `Applied a plan: ${created.length} tasks in ${plan.boxes.length} box${plan.boxes.length === 1 ? '' : 'es'}`,
            taskId: null,
          },
        ]
      )

      if (options.json && options.brief) {
        console.log(JSON.stringify({ ok: true, created }))
      } else {
        output(state, options, `Plan applied: ${created.length} tasks created`)
      }
    } catch (error) {
      fail((error as Error).message, options.json)
    }
  })

program
  .command('migrate')
  .description('Upgrade a .vertical file to the current file version')
  .argument('<file>', 'Path to the .vertical file')
  .option('--check', 'Only report whether the file needs migrating')
  .option('--json', 'Output as JSON')
  .action((file: string, options: JsonOption & { check?: boolean }) => {
    const filePath = resolveFilePath(file, options.json)
    let version = CURRENT_VERSION
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      version = fileVersion(content)
      loadState(filePath)
    } catch (error) {
      fail((error as Error).message, options.json)
    }
    const needsMigration = version < CURRENT_VERSION

    if (options.check || !needsMigration) {
      const message = needsMigration
        ? `Needs migrating: version ${version}, current is ${CURRENT_VERSION}`
        : `Up to date: version ${version}`
      console.log(
        options.json
          ? JSON.stringify({
              version,
              current: CURRENT_VERSION,
              needsMigration,
            })
          : message
      )
      if (options.check && needsMigration) process.exit(1)
      return
    }

    const backupPath = `${filePath}.v${version}.backup`
    fs.copyFileSync(filePath, backupPath)
    const state = updateState(filePath, (current) => current)
    output(
      state,
      options,
      `Migrated from version ${version} to ${CURRENT_VERSION}. The original is at ${backupPath}`
    )
  })

program
  .command('validate')
  .description('Check the board for inconsistent statuses and blockers')
  .argument('<file>', 'Path to the .vertical file')
  .option('--json', 'Output as JSON')
  .action((file: string, options: JsonOption) => {
    const filePath = resolveFilePath(file, options.json)
    const problems = validateBoard(loadState(filePath))

    if (options.json) {
      console.log(JSON.stringify({ valid: problems.length === 0, problems }))
    } else if (problems.length === 0) {
      console.log('Board is valid')
    } else {
      for (const problem of problems) console.error(problem)
    }

    if (problems.length > 0) process.exit(1)
  })

program
  .command('log')
  .description('Print the record of changes made to the board')
  .argument('<file>', 'Path to the .vertical file')
  .option('--limit <count>', 'How many of the latest events to print', '30')
  .option('--since <iso-time>', 'Only events after this time')
  .option('--json', 'Output as JSON')
  .action(
    (file: string, options: JsonOption & { limit: string; since?: string }) => {
      const filePath = resolveFilePath(file, options.json)
      const limit = Number(options.limit)
      if (!Number.isInteger(limit) || limit < 1) {
        fail(`Invalid limit: ${options.limit}`, options.json)
      }
      const since = options.since ? Date.parse(options.since) : null
      if (since !== null && Number.isNaN(since)) {
        fail(`Invalid time: ${options.since}`, options.json)
      }

      const events = loadEvents(filePath)
        .filter((event) => since === null || Date.parse(event.at) > since)
        .slice(-limit)

      if (options.json) {
        console.log(JSON.stringify(events, null, 2))
      } else if (events.length === 0) {
        console.log('No events')
      } else {
        for (const event of events) {
          console.log(`${event.at} ${event.actor}: ${event.summary}`)
        }
      }
    }
  )

program
  .command('inbox')
  .description('List tasks edited in the browser and not yet acknowledged')
  .argument('<file>', 'Path to the .vertical file')
  .option('--json', 'Output as JSON')
  .action((file: string, options: JsonOption) => {
    const filePath = resolveFilePath(file, options.json)
    const items = listInbox(loadState(filePath))

    if (options.json) {
      console.log(JSON.stringify(items, null, 2))
    } else if (items.length === 0) {
      console.log('Inbox is empty')
    } else {
      for (const item of items) {
        const where = [item.boxName ?? `Box ${item.box}`, item.layer]
          .filter(Boolean)
          .join(' / ')
        console.log(`${item.name || '(unnamed)'} · ${where} (id: ${item.id})`)
      }
    }
  })

const history = program.command('history').description('Manage board history')

history
  .command('list')
  .description('List all known boards')
  .option('--json', 'Output as JSON')
  .action((options: JsonOption) => {
    const boardHistory = loadHistory()
    if (options.json) {
      const entries = boardHistory.boards.map((b) => ({
        name: b.name,
        filePath: b.filePath,
        exists: fs.existsSync(b.filePath),
      }))
      console.log(JSON.stringify(entries, null, 2))
      return
    }
    if (boardHistory.boards.length === 0) {
      console.log('No boards known yet. Create or open a board to get started.')
      return
    }
    for (const board of boardHistory.boards) {
      const exists = fs.existsSync(board.filePath)
      const marker = exists ? '' : ' (missing)'
      console.log(`${board.name}  ${board.filePath}${marker}`)
    }
  })

history
  .command('add')
  .description('Add an existing .vertical file to history')
  .argument('<file>', 'Path to the .vertical file')
  .option('--json', 'Output as JSON')
  .action((file: string, options: JsonOption) => {
    const filePath = resolveFilePath(file, options.json)
    const state = loadState(filePath)
    try {
      recordBoard(state.project.name, filePath)
    } catch (error) {
      fail((error as Error).message, options.json)
    }
    output(
      state,
      options,
      `Added to history: ${state.project.name} → ${filePath}`
    )
  })

history
  .command('remove')
  .description('Remove a board from history (does not delete the file)')
  .argument('<name-or-file>', 'Board name or file path')
  .option('--json', 'Output as JSON')
  .action((nameOrFile: string, options: JsonOption) => {
    const removed = forgetBoard(nameOrFile)
    if (!removed) {
      fail(`Board not found in history: "${nameOrFile}"`, options.json)
    }
    if (options.json) {
      console.log(JSON.stringify({ success: true }))
    } else {
      console.log(`Removed from history: ${nameOrFile}`)
    }
  })

const task = program.command('task').description('Manage tasks')

task
  .command('add')
  .description('Add a task to a layer')
  .argument('<file>', 'Path to the .vertical file')
  .argument('<layer-id>', 'Layer ID to add the task to')
  .argument('<name>', 'Task name')
  .option('--json', 'Output as JSON')
  .option('--after <task-id>', 'Insert after a specific task')
  .action(
    (
      file: string,
      layerId: string,
      name: string,
      options: JsonOption & { after?: string }
    ) => {
      const filePath = resolveFilePath(file, options.json)
      const current = loadState(filePath)
      const id = crypto.randomUUID()

      if (options.after) {
        const afterTask = current.tasks.find((t) => t.id === options.after)
        if (!afterTask) {
          fail(`Task not found: ${options.after}`, options.json)
        }

        const nextTask = current.tasks
          .filter(
            (t) =>
              t.layerId === afterTask.layerId && t.sorting > afterTask.sorting
          )
          .sort((a, b) => a.sorting - b.sorting)[0]

        const sorting = nextTask
          ? (afterTask.sorting + nextTask.sorting) / 2
          : afterTask.sorting + 1

        const state = applyAction(filePath, {
          type: 'CREATE_TASK',
          id,
          layerId: afterTask.layerId,
          name,
          sorting,
        })
        output(state, options, `Task created (id: ${id})`, id)
        return
      }

      const layerTasks = current.tasks
        .filter((t) => t.layerId === layerId)
        .sort((a, b) => a.sorting - b.sorting)
      const sorting =
        layerTasks.length > 0
          ? layerTasks[layerTasks.length - 1].sorting + 1
          : 1

      const state = applyAction(filePath, {
        type: 'CREATE_TASK',
        id,
        layerId,
        name,
        sorting,
      })
      output(state, options, `Task created (id: ${id})`, id)
    }
  )

task
  .command('done')
  .description('Mark a task as done')
  .argument('<file>', 'Path to the .vertical file')
  .argument('<task-id>', 'Task ID')
  .option('--json', 'Output as JSON')
  .action((file: string, taskId: string, options: JsonOption) => {
    const filePath = resolveFilePath(file, options.json)
    requireTask(filePath, taskId, options.json)
    const state = applyAction(filePath, {
      type: 'SET_TASK_DONE',
      taskId,
      done: true,
    })
    output(state, options, `Task marked as done (id: ${taskId})`, taskId)
  })

task
  .command('undone')
  .description('Mark a task as not done')
  .argument('<file>', 'Path to the .vertical file')
  .argument('<task-id>', 'Task ID')
  .option('--json', 'Output as JSON')
  .action((file: string, taskId: string, options: JsonOption) => {
    const filePath = resolveFilePath(file, options.json)
    requireTask(filePath, taskId, options.json)
    const state = applyAction(filePath, {
      type: 'SET_TASK_DONE',
      taskId,
      done: false,
    })
    output(state, options, `Task marked as not done (id: ${taskId})`, taskId)
  })

task
  .command('rename')
  .description('Rename a task')
  .argument('<file>', 'Path to the .vertical file')
  .argument('<task-id>', 'Task ID')
  .argument('<name>', 'New task name')
  .option('--json', 'Output as JSON')
  .action((file: string, taskId: string, name: string, options: JsonOption) => {
    const filePath = resolveFilePath(file, options.json)
    requireTask(filePath, taskId, options.json)
    const state = applyAction(filePath, {
      type: 'RENAME_TASK',
      taskId,
      name,
    })
    output(state, options, `Task renamed (id: ${taskId})`, taskId)
  })

task
  .command('delete')
  .description('Delete a task')
  .argument('<file>', 'Path to the .vertical file')
  .argument('<task-id>', 'Task ID')
  .option('--json', 'Output as JSON')
  .action((file: string, taskId: string, options: JsonOption) => {
    const filePath = resolveFilePath(file, options.json)
    requireTask(filePath, taskId, options.json)
    const state = applyAction(filePath, { type: 'DELETE_TASK', taskId })
    output(state, options, `Task deleted (id: ${taskId})`, taskId)
  })

task
  .command('move')
  .description('Move a task to another layer')
  .argument('<file>', 'Path to the .vertical file')
  .argument('<task-id>', 'Task ID')
  .argument('<target-layer-id>', 'Target layer ID')
  .option('--json', 'Output as JSON')
  .action(
    (
      file: string,
      taskId: string,
      targetLayerId: string,
      options: JsonOption
    ) => {
      const filePath = resolveFilePath(file, options.json)
      requireTask(filePath, taskId, options.json)
      const current = loadState(filePath)

      const layerTasks = current.tasks
        .filter((t) => t.layerId === targetLayerId)
        .sort((a, b) => a.sorting - b.sorting)
      const sorting =
        layerTasks.length > 0
          ? layerTasks[layerTasks.length - 1].sorting + 1
          : 1

      const state = applyAction(filePath, {
        type: 'MOVE_TASK',
        taskId,
        layerId: targetLayerId,
        sorting,
      })
      output(state, options, `Task moved (id: ${taskId})`, taskId)
    }
  )

task
  .command('notes')
  .description('Get, set, or clear notes for a task')
  .argument('<file>', 'Path to the .vertical file')
  .argument('<task-id>', 'Task ID')
  .option('--set <html>', 'Set the notes HTML content')
  .option('--clear', 'Clear the notes')
  .option('--json', 'Output as JSON')
  .action(
    (
      file: string,
      taskId: string,
      options: JsonOption & { set?: string; clear?: boolean }
    ) => {
      const filePath = resolveFilePath(file, options.json)
      requireTask(filePath, taskId, options.json)

      if (options.set !== undefined) {
        const state = applyAction(filePath, {
          type: 'SET_TASK_NOTES',
          taskId,
          notesHtml: options.set,
        })
        output(state, options, `Notes set (id: ${taskId})`, taskId)
        return
      }

      if (options.clear) {
        const state = applyAction(filePath, {
          type: 'SET_TASK_NOTES',
          taskId,
          notesHtml: null,
        })
        output(state, options, `Notes cleared (id: ${taskId})`, taskId)
        return
      }

      const current = loadState(filePath)
      const foundTask = current.tasks.find((t) => t.id === taskId)
      if (!foundTask) {
        fail(`Task not found: ${taskId}`, options.json)
      }

      if (options.json) {
        console.log(JSON.stringify(current, null, 2))
      } else {
        console.log(foundTask.notesHtml ?? '(no notes)')
      }
    }
  )

const TASK_STATUSES = ['active', 'failed', 'blocked', 'none']

task
  .command('status')
  .description('Set a task status: active, failed, blocked or none')
  .argument('<file>', 'Path to the .vertical file')
  .argument('<task-id>', 'Task ID')
  .argument('<status>', 'active, failed, blocked or none')
  .option('--by <assignee>', 'Who holds the task')
  .option('--reason <text>', 'Why the task failed or is blocked')
  .option('--on <task-ids...>', 'Task IDs this task is blocked by')
  .option('--json', 'Output as JSON')
  .action(
    (
      file: string,
      taskId: string,
      status: string,
      options: JsonOption & { by?: string; reason?: string; on?: string[] }
    ) => {
      const filePath = resolveFilePath(file, options.json)
      const current = loadState(filePath)
      const target = current.tasks.find((t) => t.id === taskId)

      if (!target) fail(`Task not found: ${taskId}`, options.json)
      if (!TASK_STATUSES.includes(status)) {
        fail(`Unknown status: ${status}`, options.json)
      }
      if (options.on && status !== 'blocked') {
        fail('--on only applies to the blocked status', options.json)
      }
      for (const blockerId of options.on ?? []) {
        if (blockerId === taskId) {
          fail('A task cannot block itself', options.json)
        }
        if (!current.tasks.some((t) => t.id === blockerId)) {
          fail(`Task not found: ${blockerId}`, options.json)
        }
      }

      const state = applyAction(filePath, {
        type: 'SET_TASK_STATUS',
        taskId,
        status: status === 'none' ? null : (status as TaskStatus),
        reason: options.reason ?? null,
        assignee: options.by ?? (status === 'none' ? null : target.assignee),
        blockedBy: options.on ?? [],
      })
      output(
        state,
        options,
        `Task status set to ${status} (id: ${taskId})`,
        taskId
      )
    }
  )

task
  .command('link')
  .description('Attach a labelled link to a task, replacing the same label')
  .argument('<file>', 'Path to the .vertical file')
  .argument('<task-id>', 'Task ID')
  .argument('<label>', 'Link label, such as PR or verdict')
  .argument('<target>', 'URL, path or reference')
  .option('--json', 'Output as JSON')
  .action(
    (
      file: string,
      taskId: string,
      label: string,
      target: string,
      options: JsonOption
    ) => {
      const filePath = resolveFilePath(file, options.json)
      if (!loadState(filePath).tasks.some((t) => t.id === taskId)) {
        fail(`Task not found: ${taskId}`, options.json)
      }
      const state = applyAction(filePath, {
        type: 'SET_TASK_LINK',
        taskId,
        label,
        target,
      })
      output(state, options, `Link set (id: ${taskId})`, taskId)
    }
  )

task
  .command('unlink')
  .description('Remove a labelled link from a task')
  .argument('<file>', 'Path to the .vertical file')
  .argument('<task-id>', 'Task ID')
  .argument('<label>', 'Link label')
  .option('--json', 'Output as JSON')
  .action(
    (file: string, taskId: string, label: string, options: JsonOption) => {
      const filePath = resolveFilePath(file, options.json)
      requireTask(filePath, taskId, options.json)
      const state = applyAction(filePath, {
        type: 'REMOVE_TASK_LINK',
        taskId,
        label,
      })
      output(state, options, `Link removed (id: ${taskId})`, taskId)
    }
  )

task
  .command('ack')
  .description('Acknowledge a task edited in the browser')
  .argument('<file>', 'Path to the .vertical file')
  .argument('<task-id>', 'Task ID')
  .option('--json', 'Output as JSON')
  .action((file: string, taskId: string, options: JsonOption) => {
    const filePath = resolveFilePath(file, options.json)
    if (!loadState(filePath).tasks.some((t) => t.id === taskId)) {
      fail(`Task not found: ${taskId}`, options.json)
    }
    const state = applyAction(filePath, {
      type: 'SET_TASK_PICKUP',
      taskId,
      needsPickup: false,
    })
    output(state, options, `Task acknowledged (id: ${taskId})`, taskId)
  })

const box = program.command('box').description('Manage boxes (slices)')

box
  .command('rename')
  .description('Rename a box')
  .argument('<file>', 'Path to the .vertical file')
  .argument('<slice-id>', 'Slice ID')
  .argument('<name>', 'New box name')
  .option('--json', 'Output as JSON')
  .action(
    (file: string, sliceId: string, name: string, options: JsonOption) => {
      const filePath = resolveFilePath(file, options.json)
      const state = applyAction(filePath, {
        type: 'RENAME_SLICE',
        sliceId,
        name,
      })
      output(state, options, `Box renamed (id: ${sliceId})`, sliceId)
    }
  )

box
  .command('clear')
  .description('Clear the name of a box')
  .argument('<file>', 'Path to the .vertical file')
  .argument('<slice-id>', 'Slice ID')
  .option('--json', 'Output as JSON')
  .action((file: string, sliceId: string, options: JsonOption) => {
    const filePath = resolveFilePath(file, options.json)
    const state = applyAction(filePath, { type: 'UNNAME_SLICE', sliceId })
    output(state, options, `Box name cleared (id: ${sliceId})`, sliceId)
  })

box
  .command('swap')
  .description('Swap the positions of two boxes')
  .argument('<file>', 'Path to the .vertical file')
  .argument('<slice-id-1>', 'First slice ID')
  .argument('<slice-id-2>', 'Second slice ID')
  .option('--json', 'Output as JSON')
  .action(
    (file: string, sliceId1: string, sliceId2: string, options: JsonOption) => {
      const filePath = resolveFilePath(file, options.json)
      const current = loadState(filePath)

      const slice1 = current.slices.find((s) => s.id === sliceId1)
      const slice2 = current.slices.find((s) => s.id === sliceId2)

      if (!slice1 || !slice2) {
        fail('One or both slice IDs not found', options.json)
      }

      const state = applyAction(filePath, {
        type: 'SORT_SLICES',
        slices: current.slices.map((s) => {
          if (s.id === sliceId1)
            return { id: s.id, boxNumber: slice2.boxNumber }
          if (s.id === sliceId2)
            return { id: s.id, boxNumber: slice1.boxNumber }
          return { id: s.id, boxNumber: s.boxNumber }
        }),
      })
      output(state, options, `Boxes swapped (${sliceId1} <-> ${sliceId2})`)
    }
  )

const layer = program.command('layer').description('Manage layers')

layer
  .command('split')
  .description('Split a layer at a task (tasks after it go to the new layer)')
  .argument('<file>', 'Path to the .vertical file')
  .argument('<task-id>', 'Task ID to split at')
  .option('--json', 'Output as JSON')
  .action((file: string, taskId: string, options: JsonOption) => {
    const filePath = resolveFilePath(file, options.json)
    const current = loadState(filePath)

    const foundTask = current.tasks.find((t) => t.id === taskId)
    if (!foundTask) {
      fail(`Task not found: ${taskId}`, options.json)
    }

    const currentLayer = current.layers.find((l) => l.id === foundTask.layerId)
    if (!currentLayer) {
      fail(`Layer not found for task: ${taskId}`, options.json)
    }

    const nextLayer = current.layers
      .filter(
        (l) =>
          l.sliceId === currentLayer.sliceId && l.sorting > currentLayer.sorting
      )
      .sort((a, b) => a.sorting - b.sorting)[0]

    const newLayerSorting = nextLayer
      ? (currentLayer.sorting + nextLayer.sorting) / 2
      : currentLayer.sorting + 1

    const newLayerId = crypto.randomUUID()

    const state = applyAction(filePath, {
      type: 'SPLIT_LAYER',
      taskId,
      newLayerId,
      currentLayerId: currentLayer.id,
      sliceId: currentLayer.sliceId,
      taskSorting: foundTask.sorting,
      newLayerSorting,
    })
    output(
      state,
      options,
      `Layer split. New layer created (id: ${newLayerId})`,
      newLayerId
    )
  })

layer
  .command('merge')
  .description('Merge a layer with the next one (unsplit)')
  .argument('<file>', 'Path to the .vertical file')
  .argument('<layer-id>', 'Layer ID')
  .option('--json', 'Output as JSON')
  .action((file: string, layerId: string, options: JsonOption) => {
    const filePath = resolveFilePath(file, options.json)
    const state = applyAction(filePath, { type: 'UNSPLIT_LAYER', layerId })
    output(state, options, `Layer merged (id: ${layerId})`, layerId)
  })

layer
  .command('rename')
  .description('Rename a layer')
  .argument('<file>', 'Path to the .vertical file')
  .argument('<layer-id>', 'Layer ID')
  .argument('<name>', 'New layer name')
  .option('--json', 'Output as JSON')
  .action(
    (file: string, layerId: string, name: string, options: JsonOption) => {
      const filePath = resolveFilePath(file, options.json)
      const state = applyAction(filePath, {
        type: 'RENAME_LAYER',
        layerId,
        name,
      })
      output(state, options, `Layer renamed (id: ${layerId})`, layerId)
    }
  )

layer
  .command('clear')
  .description('Clear the name of a layer')
  .argument('<file>', 'Path to the .vertical file')
  .argument('<layer-id>', 'Layer ID')
  .option('--json', 'Output as JSON')
  .action((file: string, layerId: string, options: JsonOption) => {
    const filePath = resolveFilePath(file, options.json)
    const state = applyAction(filePath, { type: 'UNNAME_LAYER', layerId })
    output(state, options, `Layer name cleared (id: ${layerId})`, layerId)
  })

layer
  .command('status')
  .description('Set the status of a layer')
  .argument('<file>', 'Path to the .vertical file')
  .argument('<layer-id>', 'Layer ID')
  .argument('<status>', '"done" or "none"')
  .option('--json', 'Output as JSON')
  .action(
    (file: string, layerId: string, status: string, options: JsonOption) => {
      const filePath = resolveFilePath(file, options.json)
      const resolvedStatus = status === 'done' ? ('done' as const) : null
      const state = applyAction(filePath, {
        type: 'SET_LAYER_STATUS',
        layerId,
        status: resolvedStatus,
      })
      output(
        state,
        options,
        `Layer status set to ${status} (id: ${layerId})`,
        layerId
      )
    }
  )

program
  .command('update')
  .description('Check for and install updates')
  .option('--json', 'Output as JSON')
  .option('--check', 'Only check, do not install')
  .action(async (options: JsonOption & { check?: boolean }) => {
    const result = await checkForUpdate(packageJson.version, {
      skipCache: true,
    })

    if (!result) {
      if (options.json) {
        console.log(
          JSON.stringify({
            currentVersion: packageJson.version,
            latestVersion: packageJson.version,
            updated: false,
            message: 'Already up to date',
          })
        )
      } else {
        console.log(`Already up to date (v${packageJson.version})`)
      }
      return
    }

    if (options.check) {
      if (options.json) {
        console.log(
          JSON.stringify({
            currentVersion: packageJson.version,
            latestVersion: result.latestVersion,
            updated: false,
            updateCommand: getUpdateCommandString(result.installContext),
            message: `Update available: v${result.latestVersion}`,
          })
        )
      } else {
        console.log(
          `Update available: v${packageJson.version} → v${result.latestVersion}`
        )
        console.log(`Run: ${getUpdateCommandString(result.installContext)}`)
      }
      return
    }

    const { success, message } = await performUpdate(result.installContext)
    if (options.json) {
      console.log(
        JSON.stringify({
          currentVersion: packageJson.version,
          latestVersion: result.latestVersion,
          updated: success,
          message: success ? `Updated to v${result.latestVersion}` : message,
        })
      )
    } else {
      if (success) {
        console.log(
          `Updated: v${packageJson.version} → v${result.latestVersion}`
        )
      } else {
        console.error(`Error: ${message}`)
      }
    }

    if (!success) process.exit(1)
  })

function addSharedOptions(command: Command) {
  for (const subcommand of command.commands) {
    if (subcommand.options.some((o) => o.long === '--json')) {
      subcommand.option(
        '--brief',
        'With --json, output only { ok, id } instead of the whole board'
      )
      subcommand.option(
        '--actor <name>',
        'Who is making this change, recorded in the log'
      )
    }
    addSharedOptions(subcommand)
  }
}

addSharedOptions(program)

program.hook('preAction', (_program, actionCommand) => {
  setActor(actionCommand.opts().actor)
})

if (process.argv.length === 2) {
  program.outputHelp()
} else {
  const args = process.argv.slice(2)
  if (args.length === 1 && args[0].endsWith('.vertical')) {
    program.parse([...process.argv.slice(0, 2), 'open', args[0]])
  } else {
    program.parse(process.argv)
  }

  if (args[0] !== 'update') {
    checkAndUpdate(packageJson.version)
  }
}
