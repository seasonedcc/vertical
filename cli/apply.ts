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

function saveState(filePath: string, state: BoardState): void {
  fs.writeFileSync(filePath, serialize(state))
}

function applyAction(filePath: string, action: BoardAction): BoardState {
  const state = loadState(filePath)
  const newState = boardReducer(state, action)
  saveState(filePath, newState)
  return newState
}

function output(state: BoardState, json: boolean, message: string) {
  if (json) {
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

export { applyAction, fail, loadState, output, resolveFilePath, saveState }
