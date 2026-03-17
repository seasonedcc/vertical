import fs from 'node:fs'
import path from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command } from 'commander'
import { serialize } from '~/file/format'
import { createBlankProject } from '~/state/initial-state'
import {
  applyAction,
  fail,
  loadState,
  output,
  resolveFilePath,
} from './apply.js'
import { showBoardGrid, showSummaryTable } from './board.js'
import { startServer } from './server.js'
import { showBoard, showBoardJson } from './show.js'

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

type JsonOption = { json?: boolean }

const program = new Command()

program
  .name('itsvertical')
  .description(
    "Tickets pile up, scopes get done. Project work isn't linear, it's Vertical."
  )
  .version(packageJson.version)

program
  .command('new')
  .description('Create a new .vertical project file')
  .argument('<path>', 'File path for the new .vertical file')
  .argument('<name>', 'Project name')
  .option('--json', 'Output as JSON')
  .action((fileDest: string, name: string, options: JsonOption) => {
    const filePath = path.resolve(fileDest)

    if (fs.existsSync(filePath)) {
      fail(`File already exists: ${filePath}`, options.json)
    }

    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const state = createBlankProject(name)
    fs.writeFileSync(filePath, serialize(state))
    output(state, Boolean(options.json), `Created: ${filePath}`)
  })

program
  .command('open')
  .description('Open an existing .vertical file in the browser')
  .argument('<file>', 'Path to the .vertical file')
  .action(async (file: string) => {
    const filePath = resolveFilePath(file)
    await startServer(filePath)
  })

program
  .command('dev')
  .description('Start dev server (fixed port, no browser open)')
  .argument('<file>', 'Path to the .vertical file')
  .action(async (file: string) => {
    const filePath = resolveFilePath(file)
    await startServer(filePath, { port: 3456, open: false })
  })

program
  .command('show')
  .description('Print the board to the terminal')
  .argument('<file>', 'Path to the .vertical file')
  .option('--json', 'Output as JSON')
  .option('--box <slice-id>', 'Show only a specific box')
  .option('--visual', 'Show the board as a visual 3x3 grid with summary')
  .action(
    (
      file: string,
      options: JsonOption & { box?: string; visual?: boolean }
    ) => {
      const filePath = resolveFilePath(file, options.json)
      const state = loadState(filePath)

      if (options.box) {
        const slice = state.slices.find((s) => s.id === options.box)
        if (!slice) {
          fail(`Box not found: ${options.box}`, options.json)
        }
      }

      if (options.json) {
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
    output(state, Boolean(options.json), `Project renamed to: ${name}`)
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
        output(state, Boolean(options.json), `Task created (id: ${id})`)
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
      output(state, Boolean(options.json), `Task created (id: ${id})`)
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
    const state = applyAction(filePath, {
      type: 'SET_TASK_DONE',
      taskId,
      done: true,
    })
    output(state, Boolean(options.json), `Task marked as done (id: ${taskId})`)
  })

task
  .command('undone')
  .description('Mark a task as not done')
  .argument('<file>', 'Path to the .vertical file')
  .argument('<task-id>', 'Task ID')
  .option('--json', 'Output as JSON')
  .action((file: string, taskId: string, options: JsonOption) => {
    const filePath = resolveFilePath(file, options.json)
    const state = applyAction(filePath, {
      type: 'SET_TASK_DONE',
      taskId,
      done: false,
    })
    output(
      state,
      Boolean(options.json),
      `Task marked as not done (id: ${taskId})`
    )
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
    const state = applyAction(filePath, {
      type: 'RENAME_TASK',
      taskId,
      name,
    })
    output(state, Boolean(options.json), `Task renamed (id: ${taskId})`)
  })

task
  .command('delete')
  .description('Delete a task')
  .argument('<file>', 'Path to the .vertical file')
  .argument('<task-id>', 'Task ID')
  .option('--json', 'Output as JSON')
  .action((file: string, taskId: string, options: JsonOption) => {
    const filePath = resolveFilePath(file, options.json)
    const state = applyAction(filePath, { type: 'DELETE_TASK', taskId })
    output(state, Boolean(options.json), `Task deleted (id: ${taskId})`)
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
      output(state, Boolean(options.json), `Task moved (id: ${taskId})`)
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

      if (options.set !== undefined) {
        const state = applyAction(filePath, {
          type: 'SET_TASK_NOTES',
          taskId,
          notesHtml: options.set,
        })
        output(state, Boolean(options.json), `Notes set (id: ${taskId})`)
        return
      }

      if (options.clear) {
        const state = applyAction(filePath, {
          type: 'SET_TASK_NOTES',
          taskId,
          notesHtml: null,
        })
        output(state, Boolean(options.json), `Notes cleared (id: ${taskId})`)
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
      output(state, Boolean(options.json), `Box renamed (id: ${sliceId})`)
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
    output(state, Boolean(options.json), `Box name cleared (id: ${sliceId})`)
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
      output(
        state,
        Boolean(options.json),
        `Boxes swapped (${sliceId1} <-> ${sliceId2})`
      )
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
      Boolean(options.json),
      `Layer split. New layer created (id: ${newLayerId})`
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
    output(state, Boolean(options.json), `Layer merged (id: ${layerId})`)
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
      output(state, Boolean(options.json), `Layer renamed (id: ${layerId})`)
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
    output(state, Boolean(options.json), `Layer name cleared (id: ${layerId})`)
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
        Boolean(options.json),
        `Layer status set to ${status} (id: ${layerId})`
      )
    }
  )

if (process.argv.length === 2) {
  program.outputHelp()
} else {
  program.parse(process.argv)
}
