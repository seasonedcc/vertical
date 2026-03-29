import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

type BoardHistoryEntry = {
  name: string
  filePath: string
}

type BoardHistory = {
  version: 1
  boards: BoardHistoryEntry[]
}

function getHistoryDir() {
  return path.join(os.homedir(), '.vertical')
}

function getHistoryPath() {
  return path.join(getHistoryDir(), 'history.json')
}

function ensureHistoryDir() {
  const dir = getHistoryDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function loadHistory(): BoardHistory {
  const historyPath = getHistoryPath()
  if (!fs.existsSync(historyPath)) {
    return { version: 1, boards: [] }
  }
  const content = fs.readFileSync(historyPath, 'utf-8')
  return JSON.parse(content) as BoardHistory
}

function saveHistory(history: BoardHistory) {
  ensureHistoryDir()
  fs.writeFileSync(getHistoryPath(), JSON.stringify(history, null, 2))
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function recordBoard(name: string, filePath: string) {
  const history = loadHistory()
  const slug = slugify(name)
  const existing = history.boards.find((b) => slugify(b.name) === slug)
  if (existing && existing.filePath !== filePath) {
    throw new Error(
      `A board named "${existing.name}" is already tracked at: ${existing.filePath}`
    )
  }
  if (!existing) {
    history.boards.push({ name, filePath })
    saveHistory(history)
  }
}

function forgetBoard(nameOrPath: string) {
  const history = loadHistory()
  const slug = slugify(nameOrPath)
  const absolutePath = path.resolve(nameOrPath)
  const index = history.boards.findIndex(
    (b) => slugify(b.name) === slug || b.filePath === absolutePath
  )
  if (index === -1) {
    return false
  }
  history.boards.splice(index, 1)
  saveHistory(history)
  return true
}

export { loadHistory, recordBoard, forgetBoard }
export type { BoardHistory, BoardHistoryEntry }
