import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

type RegistryEntry = {
  name: string
  filePath: string
}

type Registry = {
  version: 1
  boards: RegistryEntry[]
}

function getRegistryDir() {
  return path.join(os.homedir(), '.vertical')
}

function getRegistryPath() {
  return path.join(getRegistryDir(), 'registry.json')
}

function ensureRegistryDir() {
  const dir = getRegistryDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function loadRegistry(): Registry {
  const registryPath = getRegistryPath()
  if (!fs.existsSync(registryPath)) {
    return { version: 1, boards: [] }
  }
  const content = fs.readFileSync(registryPath, 'utf-8')
  return JSON.parse(content) as Registry
}

function saveRegistry(registry: Registry) {
  ensureRegistryDir()
  fs.writeFileSync(getRegistryPath(), JSON.stringify(registry, null, 2))
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function registerBoard(name: string, filePath: string) {
  const registry = loadRegistry()
  const slug = slugify(name)
  const existing = registry.boards.find((b) => slugify(b.name) === slug)
  if (existing && existing.filePath !== filePath) {
    throw new Error(
      `A board named "${existing.name}" is already registered at: ${existing.filePath}`
    )
  }
  if (!existing) {
    registry.boards.push({ name, filePath })
    saveRegistry(registry)
  }
}

function unregisterBoard(nameOrPath: string) {
  const registry = loadRegistry()
  const slug = slugify(nameOrPath)
  const absolutePath = path.resolve(nameOrPath)
  const index = registry.boards.findIndex(
    (b) => slugify(b.name) === slug || b.filePath === absolutePath
  )
  if (index === -1) {
    return false
  }
  registry.boards.splice(index, 1)
  saveRegistry(registry)
  return true
}

export { loadRegistry, registerBoard, unregisterBoard }
export type { Registry, RegistryEntry }
