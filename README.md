# Vertical

**Tickets pile up, scopes get done. Project work isn't linear, it's Vertical.**

Vertical is a file-based project management tool that organizes work into vertical slices that can each be completed independently. No accounts, no cloud, no setup. Just a `.vertical` file and your terminal.

![Vertical board](app/images/screenshot.png)

```
npx itsvertical new my-project.vertical "My Project"
```

## Built for AI agents

Vertical is designed to be used through AI coding agents. The CLI is the primary interface — every entity is addressed by ID, every command accepts `--json` for structured output, and errors are machine-readable. An agent can create a project, break work into slices, add tasks, and track progress — all through the command line.

The browser UI (`itsvertical open`) is there for when you want to see the board visually, drag things around, or get a quick overview.

## How it works

Each slice is a box on the board. Add tasks to a box, and split it into layers when the work has distinct phases — design then build, for example. Slices get completed independently. Layers break the work within a slice into steps.

Everything is saved to a single `.vertical` file. Version it with git, share it with teammates, or let your agent manage it.

## Self-host the web app

Want a shared board your whole team can open with a link — no installs, no accounts? Deploy Vertical to [DigitalOcean App Platform](https://www.digitalocean.com/products/app-platform). A GitHub repo holds your `.vertical` files and is the single source of truth; the app is a multi-board workspace over that repo, and every edit is committed straight back to git.

[![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/seasonedcc/vertical/tree/main)

### Setup

1. **Create a repo for your boards** (it can be private, and can start empty). Create boards from the workspace UI or commit `.vertical` files directly — Vertical scans the whole repo recursively for `*.vertical` files.
2. **Create a fine-grained GitHub personal access token** scoped to that repo with these permissions:
   - **Contents: Read and write** — read and commit `.vertical` files
   - **Webhooks: Read and write** — register the push webhook that drives live updates
   - **Metadata: Read-only** — required, granted automatically

   Do **not** grant Administration.
3. **Pick a webhook secret** — any random string. It signs incoming webhook deliveries.
4. **Click the button above** and fill in the prompted variables:

   | Variable | Required | Description |
   |----------|----------|-------------|
   | `VERTICAL_GITHUB_REPO` | yes | `owner/repo` of your boards repo |
   | `VERTICAL_GITHUB_TOKEN` | yes | the fine-grained PAT (stored as a secret) |
   | `VERTICAL_WEBHOOK_SECRET` | yes | your webhook secret (stored as a secret) |
   | `VERTICAL_GITHUB_BRANCH` | no | branch to use (defaults to the repo's default branch) |

On boot the app registers a push webhook against its own public URL, so changes — whether made in the browser, committed from git, or written by the CLI — show up live for everyone with the link.

### Notes

- **Access is open.** v1 has no authentication — anyone with the URL can view and edit. Git history is your audit log and undo button. Keep the app URL private or put it behind your own access layer.
- **One instance.** The app runs with `instance_count: 1` (the template sets this). Live updates and webhook handling are in-memory and don't span replicas.
- **The Vertical repo stays public.** The Deploy button needs a public template repo — that's the _app_ repo (`seasonedcc/vertical`). Your _boards_ repo, supplied via `VERTICAL_GITHUB_REPO`, can be private.
- **No database.** All state lives in your GitHub repo.

## Install

```
npm install -g itsvertical
```

Or run directly with npx:

```
npx itsvertical new my-project.vertical "My Project"
```

### Agent skill

Install the [Vertical skill](https://skills.sh/seasonedcc/vertical/vertical) to teach your AI agent how to use Vertical:

```
npx skills add seasonedcc/vertical
```

This gives agents like Claude Code, Cursor, and GitHub Copilot procedural knowledge of all Vertical commands and workflows.

## Commands

All entities are addressed by ID. Use `itsvertical show` to see IDs. Every command accepts `--json` to output the full board state as JSON (useful for agents).

### Project

```
itsvertical <file>                              # Shorthand for "open"
itsvertical new <path> <name>                   # Create a new .vertical file
itsvertical open <file>                         # Open a board in the browser UI
itsvertical open <dir>                          # Open a workspace over a folder of boards
itsvertical show <file>                         # Print the board to the terminal
itsvertical show <file> --json                  # Output the board as JSON
itsvertical show <file> --box <slice-id>        # Show only a specific box
itsvertical show <file> --visual               # Show the board as a visual 3x3 grid with summary
itsvertical rename <file> <name>                # Rename the project
```

### Tasks

```
itsvertical task add <file> <layer-id> <name>   # Add a task to a layer
itsvertical task add <file> <lid> <n> --after <tid>  # Insert after a specific task
itsvertical task done <file> <task-id>          # Mark a task as done
itsvertical task undone <file> <task-id>        # Mark a task as not done
itsvertical task rename <file> <task-id> <name> # Rename a task
itsvertical task delete <file> <task-id>        # Delete a task
itsvertical task move <file> <task-id> <layer>  # Move a task to another layer
itsvertical task notes <file> <task-id>        # Print task notes
itsvertical task notes <file> <tid> --set <html>  # Set notes (HTML)
itsvertical task notes <file> <task-id> --clear   # Clear notes
```

### Boxes

```
itsvertical box rename <file> <slice-id> <name> # Rename a box
itsvertical box clear <file> <slice-id>         # Clear box name
itsvertical box swap <file> <id-1> <id-2>       # Swap two box positions
```

### Layers

```
itsvertical layer split <file> <task-id>        # Split at a task (tasks after go to new layer)
itsvertical layer merge <file> <layer-id>       # Merge with the next layer
itsvertical layer rename <file> <layer-id> <n>  # Rename a layer
itsvertical layer clear <file> <layer-id>       # Clear layer name
itsvertical layer status <file> <layer-id> done # Set status to "done"
itsvertical layer status <file> <layer-id> none # Clear status
```

### Board History

Vertical automatically tracks boards you create and open in `~/.vertical/history.json`.

```
itsvertical history list                       # List all known boards
itsvertical history add <file>                 # Manually add a board to history
itsvertical history remove <name-or-file>      # Remove a board from history
```

### Browser UI

`itsvertical open` (or just `itsvertical <file>`) starts a local server and opens the board in your browser. Changes are saved automatically. Point it at a folder (`itsvertical open <dir>`) to get a multi-board workspace over every `.vertical` file inside — the same workspace the [self-hosted web app](#self-host-the-web-app) serves.

## The board

Each box represents a vertical slice of work.

- **Name boxes** by clicking the title area
- **Drag boxes** to rearrange them in the grid
- **Add tasks** by clicking the input at the bottom of a box
- **Edit tasks** by clicking on them
- **Mark tasks done** with the circle checkbox
- **Add notes** to a task by clicking the sticky note icon (rich text editor with formatting, slash commands, and code blocks)
- **Drag tasks** between boxes and layers
- **Split layers** with the scissor tool (click ✂ or press **S**, then click a task to split at that point)
- **Unsplit layers** by focusing the dashed separator and pressing **Delete**
- **Set layer status** to "done" via the status dropdown

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| **S** | Toggle split mode |
| **Escape** | Exit split mode / deselect |
| **Delete** / **Backspace** | Delete focused task or unsplit focused layer |
| **Enter** | Save inline edit |
| **Shift+Enter** | Save edit and create a new task below |

## The `.vertical` file

It's just JSON. You can version it with git, share it with teammates, or back it up however you like.

```json
{
  "version": 1,
  "project": { "name": "My Project" },
  "slices": [],
  "layers": [],
  "tasks": []
}
```

## Development

Source at [github.com/seasonedcc/vertical](https://github.com/seasonedcc/vertical).

### Architecture

The package has two parts:

- **SPA** (`app/`) — A React app built with Vite. The board UI. Built to `dist/`.
- **CLI** (`cli/`) — A Node.js CLI built with tsup. Starts a local HTTP server that serves the SPA and provides a read/write API for the `.vertical` file. Built to `cli/dist/`.

The CLI and SPA share code: types (`app/state/types.ts`), serialization (`app/file/format.ts`), project creation (`app/state/initial-state.ts`), the reducer (`app/state/reducer.ts`), and conflict detection (`app/state/conflict.ts`).

### Storage adapters

The server speaks one protocol — list boards, load a board, apply an action, subscribe to changes — implemented by two storage adapters (`cli/adapters/`): a **local** adapter over a directory (`fs.watch` for live updates, content hash for revisions) and a **GitHub** adapter over a repo (push webhook for live updates, blob sha for revisions). The SPA is backend-agnostic; the same workspace UI runs on both.

### State management

The board view uses `useReducer` + React Context for optimistic local state. Writes are **action-based and server-authoritative**: the browser sends the reducer action (not the whole file) to `POST /api/projects/:id/actions`, and the server applies it against the latest state via the shared reducer. Concurrent edits are detected with an entity-level, field-scoped diff (`app/state/conflict.ts`) and **rejected, not overwritten** — the browser rolls back, reloads, and shows a toast. Live updates arrive over SSE (`GET /api/events`) carrying `{ boardId, revision }`. The sync state machine lives at `app/sync/sync-reducer.ts`.

The HTTP surface: `GET /api/projects` (list), `GET/PATCH/DELETE /api/projects/:id`, `POST /api/projects` (create), `POST /api/projects/:id/actions` (apply), `GET /api/events` (SSE), and `POST /api/webhook/github` (GitHub adapter only).

### Build

```
pnpm run build        # builds both SPA (vite) and CLI (tsup)
pnpm run build:cli    # builds only the CLI
```

### Dev

```
pnpm run dev
```

Starts a full dev environment with Vite HMR for the SPA and auto-restart for the CLI server. Creates a `dev.vertical` file from `sample.vertical` on first run (preserved across restarts). The browser opens automatically.

- **SPA:** Vite dev server at `http://localhost:4007` with HMR
- **CLI server:** Rebuilds and restarts automatically on changes (port 3456)
- **API proxy:** Vite proxies `/api/*` to the CLI server

### Test locally

```
pnpm run build
pnpm run itsvertical -- new test-project.vertical "Test Project"
pnpm run itsvertical -- open test-project.vertical
```

### Test

```
pnpm run test
```

Unit tests use [Vitest](https://vitest.dev). Tests are co-located with source files (`*.test.ts`).

### Lint and type-check

```
pnpm run tsc
pnpm run lint
```

### Publish

Use the `/release` skill in Claude Code to publish a new version. It bumps the version, builds, and creates a GitHub release. You only need to run `npm publish` yourself (for OTP).

## Credits

Made by [Ryan Singer](https://ryansinger.co) and [Seasoned](https://www.seasoned.cc).

## License

MIT
