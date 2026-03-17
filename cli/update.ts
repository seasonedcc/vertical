import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CACHE_DIR = path.join(os.homedir(), '.itsvertical')
const CACHE_FILE = path.join(CACHE_DIR, 'update-check.json')
const CHECK_INTERVAL = 86_400_000
const FETCH_TIMEOUT = 5_000
const REGISTRY_URL = 'https://registry.npmjs.org/itsvertical/latest'

type GlobalInstall = {
  type: 'global'
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun'
}
type NpxCache = { type: 'npx-cache'; cachePath: string }
type BunxCache = { type: 'bunx-cache'; cacheDir: string }
type LocalInstall = { type: 'local' }
type UnknownInstall = { type: 'unknown' }
type InstallContext =
  | GlobalInstall
  | NpxCache
  | BunxCache
  | LocalInstall
  | UnknownInstall

type UpdateCache = {
  lastCheck: number
  latestVersion: string
  currentVersion: string
  installContext: InstallContext
  scriptPath: string
}

type UpdateInfo = {
  latestVersion: string
  installContext: InstallContext
}

// --- Semver ---

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0
    const nb = pb[i] ?? 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

// --- Path utilities ---

function isPathInside(childPath: string, parentPath: string): boolean {
  const relative = path.relative(parentPath, childPath)
  return (
    relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
  )
}

function resolveScriptPath(scriptPath: string): string {
  try {
    return fs.realpathSync(scriptPath)
  } catch {
    return scriptPath
  }
}

// --- Global directory detection (patterns from sindresorhus/global-directory) ---

function getNpmGlobalPackages(): string {
  const isWindows = process.platform === 'win32'

  const envKey = Object.keys(process.env).find(
    (k) => k.toLowerCase() === 'npm_config_prefix'
  )
  const envValue = envKey ? process.env[envKey] : undefined
  if (envValue) {
    const prefix = path.resolve(envValue)
    return path.join(prefix, isWindows ? 'node_modules' : 'lib/node_modules')
  }

  let prefix: string
  if (isWindows) {
    prefix = process.env.APPDATA
      ? path.join(process.env.APPDATA, 'npm')
      : path.dirname(process.execPath)
  } else if (process.execPath.includes('/Cellar/node')) {
    prefix = process.execPath.slice(0, process.execPath.indexOf('/Cellar/node'))
  } else {
    prefix = path.dirname(path.dirname(process.execPath))
  }

  return path.join(prefix, isWindows ? 'node_modules' : 'lib/node_modules')
}

function getPnpmGlobalDir(): string {
  if (process.env.PNPM_HOME) return process.env.PNPM_HOME
  if (process.env.XDG_DATA_HOME)
    return path.join(process.env.XDG_DATA_HOME, 'pnpm')
  if (process.platform === 'darwin')
    return path.join(os.homedir(), 'Library/pnpm')
  if (process.platform !== 'win32')
    return path.join(os.homedir(), '.local/share/pnpm')
  if (process.env.LOCALAPPDATA)
    return path.join(process.env.LOCALAPPDATA, 'pnpm')
  return path.join(os.homedir(), '.pnpm')
}

function getYarnGlobalPackages(): string {
  const isWindows = process.platform === 'win32'
  let dataDir: string
  if (isWindows) {
    dataDir = process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'Yarn/Data')
      : path.join(os.homedir(), '.config/yarn')
  } else if (process.env.XDG_DATA_HOME) {
    dataDir = path.join(process.env.XDG_DATA_HOME, 'yarn')
  } else {
    dataDir = path.join(os.homedir(), '.config/yarn')
  }
  return path.join(dataDir, 'global/node_modules')
}

function getBunGlobalDir(): string {
  return process.env.BUN_INSTALL || path.join(os.homedir(), '.bun')
}

// --- Install context detection ---

function detectInstallContext(scriptPath: string): InstallContext {
  const resolved = resolveScriptPath(scriptPath)

  const npxMatch = resolved.match(/(.+\/_npx\/[^/]+)/)
  if (npxMatch) {
    return { type: 'npx-cache', cachePath: npxMatch[1] }
  }

  const bunDir = path.resolve(getBunGlobalDir())
  if (isPathInside(resolved, bunDir)) {
    const bunCacheDir = path.join(bunDir, 'install', 'cache')
    if (isPathInside(resolved, bunCacheDir)) {
      return { type: 'bunx-cache', cacheDir: bunCacheDir }
    }
    return { type: 'global', packageManager: 'bun' }
  }

  const pnpmDir = path.resolve(getPnpmGlobalDir())
  if (isPathInside(resolved, pnpmDir)) {
    return { type: 'global', packageManager: 'pnpm' }
  }

  const yarnPackages = path.resolve(getYarnGlobalPackages())
  if (isPathInside(resolved, yarnPackages)) {
    return { type: 'global', packageManager: 'yarn' }
  }

  try {
    const npmPackages = fs.realpathSync(getNpmGlobalPackages())
    if (isPathInside(resolved, npmPackages)) {
      return { type: 'global', packageManager: 'npm' }
    }
  } catch {}

  if (
    resolved.includes('/node_modules/itsvertical/') ||
    resolved.includes('\\node_modules\\itsvertical\\')
  ) {
    return { type: 'local' }
  }

  return { type: 'unknown' }
}

// --- Cache ---

function readCache(): UpdateCache | null {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'))
  } catch {
    return null
  }
}

function writeCache(cache: UpdateCache): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache))
  } catch {}
}

// --- Check ---

function shouldCheckForUpdate(currentVersion: string): boolean {
  if (process.env.NO_UPDATE_CHECK) return false

  const cache = readCache()
  if (!cache) return true

  const scriptPath = resolveScriptPath(process.argv[1])
  if (cache.scriptPath !== scriptPath) return true
  if (cache.currentVersion !== currentVersion) return true
  if (Date.now() - cache.lastCheck >= CHECK_INTERVAL) return true

  return false
}

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
    const response = await fetch(REGISTRY_URL, { signal: controller.signal })
    clearTimeout(timeout)
    if (!response.ok) return null
    const data = (await response.json()) as { version?: string }
    return data.version ?? null
  } catch {
    return null
  }
}

async function checkForUpdate(
  currentVersion: string
): Promise<UpdateInfo | null> {
  if (!shouldCheckForUpdate(currentVersion)) {
    const cache = readCache()
    if (cache && compareSemver(cache.latestVersion, currentVersion) > 0) {
      return {
        latestVersion: cache.latestVersion,
        installContext: cache.installContext,
      }
    }
    return null
  }

  const latestVersion = await fetchLatestVersion()
  if (!latestVersion) return null

  const scriptPath = resolveScriptPath(process.argv[1])
  const installContext = detectInstallContext(scriptPath)

  writeCache({
    lastCheck: Date.now(),
    latestVersion,
    currentVersion,
    installContext,
    scriptPath,
  })

  if (compareSemver(latestVersion, currentVersion) > 0) {
    return { latestVersion, installContext }
  }

  return null
}

// --- Update ---

function getUpdateCommand(
  context: InstallContext
): [string, ...string[]] | null {
  if (context.type === 'local') return null
  if (context.type === 'npx-cache') return null
  if (context.type === 'bunx-cache') return null

  const pm = context.type === 'global' ? context.packageManager : 'npm'
  switch (pm) {
    case 'npm':
      return ['npm', 'install', '-g', 'itsvertical@latest']
    case 'pnpm':
      return ['pnpm', 'add', '-g', 'itsvertical@latest']
    case 'yarn':
      return ['yarn', 'global', 'add', 'itsvertical@latest']
    case 'bun':
      return ['bun', 'install', '-g', 'itsvertical@latest']
  }
}

function getUpdateCommandString(context: InstallContext): string {
  const cmd = getUpdateCommand(context)
  if (!cmd) return 'npm install -g itsvertical@latest'
  return cmd.join(' ')
}

async function performUpdate(
  context: InstallContext
): Promise<{ success: boolean; message: string }> {
  if (context.type === 'npx-cache') {
    try {
      fs.rmSync(context.cachePath, { recursive: true, force: true })
      return {
        success: true,
        message: 'Cleared npx cache. Next run will fetch the latest version.',
      }
    } catch {
      return { success: false, message: 'Failed to clear npx cache.' }
    }
  }

  if (context.type === 'bunx-cache') {
    try {
      for (const entry of fs.readdirSync(context.cacheDir)) {
        if (entry.startsWith('itsvertical@')) {
          fs.rmSync(path.join(context.cacheDir, entry), {
            recursive: true,
            force: true,
          })
        }
      }
      return {
        success: true,
        message: 'Cleared bunx cache. Next run will fetch the latest version.',
      }
    } catch {
      return { success: false, message: 'Failed to clear bunx cache.' }
    }
  }

  if (context.type === 'local') {
    return {
      success: false,
      message:
        'Cannot auto-update a local dependency. Update your package.json instead.',
    }
  }

  const cmd = getUpdateCommand(context)
  if (!cmd) {
    return { success: false, message: 'Could not determine update command.' }
  }

  return new Promise((resolve) => {
    execFile(cmd[0], cmd.slice(1), { timeout: 60_000 }, (error) => {
      if (error) {
        resolve({
          success: false,
          message: `Update failed. Run manually: ${cmd.join(' ')}`,
        })
      } else {
        resolve({ success: true, message: 'Updated successfully.' })
      }
    })
  })
}

// --- Fire-and-forget ---

async function checkAndUpdate(currentVersion: string): Promise<void> {
  try {
    const result = await checkForUpdate(currentVersion)
    if (!result) return
    if (result.installContext.type === 'local') return
    await performUpdate(result.installContext)
  } catch {}
}

export {
  type InstallContext,
  type UpdateCache,
  type UpdateInfo,
  checkAndUpdate,
  checkForUpdate,
  compareSemver,
  detectInstallContext,
  fetchLatestVersion,
  getUpdateCommandString,
  isPathInside,
  performUpdate,
  shouldCheckForUpdate,
}
