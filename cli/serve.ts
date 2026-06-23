import path from 'node:path'
import { createGithubAdapter } from './adapters/github.js'
import { createLocalAdapter } from './adapters/local.js'
import type { StorageAdapter } from './adapters/types.js'
import { startServer } from './server.js'

type ResolvedAdapter = {
  adapter: StorageAdapter
  config: Record<string, unknown>
  label: string
}

async function createAdapterFromEnv(dir?: string): Promise<ResolvedAdapter> {
  const githubRepo = process.env.VERTICAL_GITHUB_REPO
  if (githubRepo) {
    const token = process.env.VERTICAL_GITHUB_TOKEN
    if (!token) {
      throw new Error(
        'VERTICAL_GITHUB_TOKEN is required when VERTICAL_GITHUB_REPO is set'
      )
    }
    const adapter = createGithubAdapter({
      repo: githubRepo,
      token,
      branch: process.env.VERTICAL_GITHUB_BRANCH,
      webhookSecret: process.env.VERTICAL_WEBHOOK_SECRET,
      publicUrl: process.env.PUBLIC_URL,
    })
    await adapter.ensureWebhook()
    return {
      adapter,
      config: { adapter: 'github', repo: githubRepo },
      label: `GitHub: ${githubRepo}`,
    }
  }

  const root = path.resolve(dir ?? process.env.VERTICAL_DIR ?? process.cwd())
  return {
    adapter: createLocalAdapter(root),
    config: { adapter: 'local', root },
    label: `Workspace: ${root}`,
  }
}

async function runServe(dir?: string) {
  const { adapter, config, label } = await createAdapterFromEnv(dir)
  const port = process.env.PORT ? Number(process.env.PORT) : 8080
  await startServer(adapter, {
    port,
    host: '0.0.0.0',
    open: false,
    config,
    label,
  })
}

export { createAdapterFromEnv, runServe }
