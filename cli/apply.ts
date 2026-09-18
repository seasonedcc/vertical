import fs from 'node:fs'
import path from 'node:path'
import { deserialize, serialize } from '~/file/format'
import type { BoardAction } from '~/state/actions'
import { boardReducer } from '~/state/reducer'
import type { BoardState } from '~/state/types'
import { showBoardJson } from './show.js'

function resolveFilePath(file: string, json?: boolean) {
  const filePath = path.resolve(file)
  if (!fs.existsSync(filePath)) {
    fail(`File not found: ${filePath}`, json)
  }
  return filePath
}

function loadState(filePath: string): BoardState {
  const content = fs.readFileSync(filePath, 'utf-8')
  return deserialize(content)
}

const LOCK_WAIT_MILLISECONDS = 5000
const STALE_LOCK_MILLISECONDS = 10000

function writeFileAtomic(filePath: string, content: string) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`
  fs.writeFileSync(temporaryPath, content)
  fs.renameSync(temporaryPath, filePath)
}

function removeStaleLock(lockPath: string) {
  try {
    const age = Date.now() - fs.statSync(lockPath).mtimeMs
    if (age > STALE_LOCK_MILLISECONDS) fs.rmSync(lockPath, { force: true })
  } catch {
    return
  }
}

function withFileLock<T>(filePath: string, run: () => T) {
  const lockPath = `${filePath}.lock`
  const deadline = Date.now() + LOCK_WAIT_MILLISECONDS
  const sleeper = new Int32Array(new SharedArrayBuffer(4))

  while (true) {
    try {
      fs.closeSync(fs.openSync(lockPath, 'wx'))
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      removeStaleLock(lockPath)
      if (Date.now() > deadline) {
        throw new Error(`Board is locked by another process: ${lockPath}`)
      }
      Atomics.wait(sleeper, 0, 0, 25)
    }
  }

  try {
    return run()
  } finally {
    fs.rmSync(lockPath, { force: true })
  }
}

function saveState(filePath: string, state: BoardState): void {
  writeFileAtomic(filePath, serialize(state))
}

function updateState(
  filePath: string,
  update: (state: BoardState) => BoardState
) {
  return withFileLock(filePath, () => {
    const newState = update(loadState(filePath))
    saveState(filePath, newState)
    return newState
  })
}

function applyAction(filePath: string, action: BoardAction): BoardState {
  return updateState(filePath, (state) => boardReducer(state, action))
}

type OutputOptions = { json?: boolean; brief?: boolean }

function output(
  state: BoardState,
  options: OutputOptions,
  message: string,
  entityId?: string
) {
  if (options.json && options.brief) {
    console.log(
      JSON.stringify(entityId ? { ok: true, id: entityId } : { ok: true })
    )
  } else if (options.json) {
    showBoardJson(state)
  } else {
    console.log(message)
  }
}

function fail(message: string, json?: boolean): never {
  if (json) {
    console.log(JSON.stringify({ error: message }))
  } else {
    console.error(`Error: ${message}`)
  }
  process.exit(1)
}

export {
  applyAction,
  fail,
  loadState,
  output,
  resolveFilePath,
  saveState,
  updateState,
  withFileLock,
  writeFileAtomic,
}
export type { OutputOptions }
