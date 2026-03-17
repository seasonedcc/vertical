import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { compareSemver, detectInstallContext, isPathInside } from './update'

function unsetEnv(key: string) {
  delete process.env[key]
}

describe('compareSemver', () => {
  it('returns 0 for equal versions', () => {
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0)
  })

  it('returns 1 when first is greater (major)', () => {
    expect(compareSemver('2.0.0', '1.0.0')).toBe(1)
  })

  it('returns -1 when first is less (major)', () => {
    expect(compareSemver('1.0.0', '2.0.0')).toBe(-1)
  })

  it('compares minor versions', () => {
    expect(compareSemver('1.2.0', '1.1.0')).toBe(1)
    expect(compareSemver('1.1.0', '1.2.0')).toBe(-1)
  })

  it('compares patch versions', () => {
    expect(compareSemver('1.0.2', '1.0.1')).toBe(1)
    expect(compareSemver('1.0.1', '1.0.2')).toBe(-1)
  })

  it('handles multi-digit segments', () => {
    expect(compareSemver('1.10.0', '1.9.0')).toBe(1)
    expect(compareSemver('0.0.12', '0.0.9')).toBe(1)
  })

  it('handles different length versions', () => {
    expect(compareSemver('1.0', '1.0.0')).toBe(0)
    expect(compareSemver('1.0.1', '1.0')).toBe(1)
  })
})

describe('isPathInside', () => {
  it('returns true for a nested path', () => {
    expect(isPathInside('/a/b/c', '/a/b')).toBe(true)
  })

  it('returns false for the same path', () => {
    expect(isPathInside('/a/b', '/a/b')).toBe(false)
  })

  it('returns false for a sibling path', () => {
    expect(isPathInside('/a/c', '/a/b')).toBe(false)
  })

  it('returns false for a parent path', () => {
    expect(isPathInside('/a', '/a/b')).toBe(false)
  })
})

describe('detectInstallContext', () => {
  it('detects npx cache', () => {
    const result = detectInstallContext(
      '/Users/me/.npm/_npx/abc123/node_modules/itsvertical/cli/dist/index.js'
    )
    expect(result).toEqual({
      type: 'npx-cache',
      cachePath: '/Users/me/.npm/_npx/abc123',
    })
  })

  it('detects bun global install', () => {
    const home = require('node:os').homedir()
    const result = detectInstallContext(
      `${home}/.bun/install/global/node_modules/itsvertical/cli/dist/index.js`
    )
    expect(result).toEqual({ type: 'global', packageManager: 'bun' })
  })

  it('detects bun global install with BUN_INSTALL env', () => {
    const original = process.env.BUN_INSTALL
    process.env.BUN_INSTALL = '/custom/bun'
    try {
      const result = detectInstallContext(
        '/custom/bun/install/global/node_modules/itsvertical/cli/dist/index.js'
      )
      expect(result).toEqual({ type: 'global', packageManager: 'bun' })
    } finally {
      if (original === undefined) {
        unsetEnv('BUN_INSTALL')
      } else {
        process.env.BUN_INSTALL = original
      }
    }
  })

  it('detects pnpm global install on macOS', () => {
    const original = process.env.PNPM_HOME
    unsetEnv('PNPM_HOME')
    const originalXdg = process.env.XDG_DATA_HOME
    unsetEnv('XDG_DATA_HOME')
    const originalPlatform = Object.getOwnPropertyDescriptor(
      process,
      'platform'
    )

    try {
      Object.defineProperty(process, 'platform', { value: 'darwin' })
      const home = require('node:os').homedir()
      const result = detectInstallContext(
        `${home}/Library/pnpm/global/5/node_modules/itsvertical/cli/dist/index.js`
      )
      expect(result).toEqual({ type: 'global', packageManager: 'pnpm' })
    } finally {
      if (original !== undefined) process.env.PNPM_HOME = original
      if (originalXdg !== undefined) process.env.XDG_DATA_HOME = originalXdg
      if (originalPlatform)
        Object.defineProperty(process, 'platform', originalPlatform)
    }
  })

  it('detects pnpm global install via PNPM_HOME', () => {
    const original = process.env.PNPM_HOME
    process.env.PNPM_HOME = '/custom/pnpm'
    try {
      const result = detectInstallContext(
        '/custom/pnpm/global/5/node_modules/itsvertical/cli/dist/index.js'
      )
      expect(result).toEqual({ type: 'global', packageManager: 'pnpm' })
    } finally {
      if (original === undefined) {
        unsetEnv('PNPM_HOME')
      } else {
        process.env.PNPM_HOME = original
      }
    }
  })

  it('detects yarn global install', () => {
    const home = require('node:os').homedir()
    const originalXdg = process.env.XDG_DATA_HOME
    unsetEnv('XDG_DATA_HOME')
    try {
      const result = detectInstallContext(
        `${home}/.config/yarn/global/node_modules/itsvertical/cli/dist/index.js`
      )
      expect(result).toEqual({ type: 'global', packageManager: 'yarn' })
    } finally {
      if (originalXdg !== undefined) process.env.XDG_DATA_HOME = originalXdg
    }
  })

  it('detects npm global install via lib/node_modules', () => {
    const execDir = require('node:path').dirname(
      require('node:path').dirname(process.execPath)
    )
    const result = detectInstallContext(
      `${execDir}/lib/node_modules/itsvertical/cli/dist/index.js`
    )
    expect(result).toEqual({ type: 'global', packageManager: 'npm' })
  })

  it('detects local dependency', () => {
    const result = detectInstallContext(
      '/my/project/node_modules/itsvertical/cli/dist/index.js'
    )
    expect(result).toEqual({ type: 'local' })
  })

  it('returns unknown for unrecognized paths', () => {
    const result = detectInstallContext('/some/random/path/index.js')
    expect(result).toEqual({ type: 'unknown' })
  })
})

describe('shouldCheckForUpdate', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'vertical-update-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
    vi.restoreAllMocks()
    unsetEnv('NO_UPDATE_CHECK')
  })

  it('returns false when NO_UPDATE_CHECK is set', async () => {
    process.env.NO_UPDATE_CHECK = '1'
    const { shouldCheckForUpdate } = await import('./update')
    expect(shouldCheckForUpdate('1.0.0')).toBe(false)
  })

  it('returns true when no cache exists', async () => {
    const { shouldCheckForUpdate } = await import('./update')
    expect(shouldCheckForUpdate('1.0.0')).toBe(true)
  })
})

describe('fetchLatestVersion', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns version from registry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: '2.0.0' }),
      })
    )

    const { fetchLatestVersion } = await import('./update')
    const version = await fetchLatestVersion()
    expect(version).toBe('2.0.0')
  })

  it('returns null on network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network error'))
    )

    const { fetchLatestVersion } = await import('./update')
    const version = await fetchLatestVersion()
    expect(version).toBeNull()
  })

  it('returns null on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      })
    )

    const { fetchLatestVersion } = await import('./update')
    const version = await fetchLatestVersion()
    expect(version).toBeNull()
  })
})

describe('performUpdate', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'vertical-update-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('removes npx cache directory', async () => {
    const cachePath = join(tempDir, 'npx-cache')
    require('node:fs').mkdirSync(cachePath)
    writeFileSync(join(cachePath, 'package.json'), '{}')

    const { performUpdate } = await import('./update')
    const result = await performUpdate({ type: 'npx-cache', cachePath })
    expect(result.success).toBe(true)
    expect(require('node:fs').existsSync(cachePath)).toBe(false)
  })

  it('returns failure for local installs', async () => {
    const { performUpdate } = await import('./update')
    const result = await performUpdate({ type: 'local' })
    expect(result.success).toBe(false)
  })
})
