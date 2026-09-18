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
itsvertical open <file>                         # Open in the browser UI
itsvertical show <file>                         # Print the board to the terminal
itsvertical show <file> --json                  # Output the board as JSON
itsvertical show <file> --box <slice-id>        # Show only a specific box
itsvertical show <file> --visual               # Show the board as a visual 3x3 grid with summary
itsvertical show <file> --summary              # Counts per box and layer in a few lines
itsvertical apply <file> <plan.json>           # Fill empty boxes from a plan in one call
itsvertical validate <file>                    # Check statuses and blockers, exit 1 on problems
itsvertical migrate <file>                     # Upgrade an older file to the current file version
itsvertical migrate <file> --check             # Only say whether it needs it (exit 1 if so)
itsvertical inbox <file>                       # Tasks edited in the browser, not yet acknowledged
itsvertical log <file>                         # The record of changes: when, who, what
itsvertical log <file> --since <iso-time>      # Only what changed after a moment
itsvertical open <file> --read-only            # Serve the board for viewing only
itsvertical new <path> <name> --no-track       # Create a board without recording it in the history
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
itsvertical task status <file> <tid> active --by <who>      # Someone is working on it
itsvertical task status <file> <tid> failed --reason <text> # It failed, and why
itsvertical task status <file> <tid> blocked --on <tid...>  # It waits on other tasks
itsvertical task status <file> <tid> none        # Clear the status
itsvertical task link <file> <tid> <label> <target>  # Attach a link (PR, verdict, doc)
itsvertical task unlink <file> <tid> <label>     # Remove a link
itsvertical task ack <file> <tid>                # Acknowledge a task edited in the browser
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

### Working alongside an agent

A task is done or not, and it can also be `active`, `failed` or `blocked`. Marking a task done clears its status and unblocks the tasks that were waiting on it. Links carry a label and a target, so a task can point at its pull request or at a file.

`apply` fills empty boxes from a plan file, so an agent seeds a whole board in one call:

```json
{
  "boxes": [
    {
      "box": 1,
      "name": "Download button",
      "layers": [
        { "name": "Build", "tasks": [{ "name": "Button", "key": "button" }] },
        { "name": "Verify", "tasks": [{ "name": "Walkthrough", "blockedBy": ["button"] }] }
      ]
    }
  ]
}
```

A task's `key` only lives in the plan: `blockedBy` refers to it, and the output maps each key to the id it became.

Add `--brief` to `--json` on any command that changes the board and it prints `{ "ok": true, "id": "..." }` instead of the whole board.

The CLI and the browser can write to the same file at the same time. Every write takes a lock and replaces the file atomically, and the browser sends the changes you made, not the whole board, so neither side overwrites the other.

Every change is recorded in the file with its time and its actor. The CLI records `cli` unless you pass `--actor <name>` or set `VERTICAL_ACTOR`, and the browser records `browser`. Read the record with `itsvertical log <file>`, or from the Activity button in the browser.

Open the board with `itsvertical open <file> --read-only` to watch without being able to change anything: the editing controls are off and the server refuses writes.

Open the board with `itsvertical open <file> --inbox` and every task you add or edit in the browser is flagged. The agent reads the flagged tasks with `itsvertical inbox <file>` and clears each one with `itsvertical task ack`.

### Browser UI

`itsvertical open` (or just `itsvertical <file>`) starts a local server and opens the board in your browser. Changes are saved automatically.

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
  "version": 2,
  "project": { "name": "My Project" },
  "slices": [],
  "layers": [],
  "tasks": [],
  "events": []
}
```

### File versions

Files from older releases keep working. Vertical reads a version 1 file as it is, and nothing is written until you change something: the first change saves the file as version 2 and notes the migration in its log. `itsvertical migrate <file>` does the same upgrade on its own and leaves the original beside it as `<file>.v1.backup`.

An older Vertical refuses a version 2 file instead of opening it and dropping what it does not know, so update everyone who shares a board: `itsvertical update`.

## Development

Source at [github.com/seasonedcc/vertical](https://github.com/seasonedcc/vertical).

### Architecture

The package has two parts:

- **SPA** (`app/`) — A React app built with Vite. The board UI. Built to `dist/`.
- **CLI** (`cli/`) — A Node.js CLI built with tsup. Starts a local HTTP server that serves the SPA and provides a read/write API for the `.vertical` file. Built to `cli/dist/`.

The CLI and SPA share code: types (`app/state/types.ts`), serialization (`app/file/format.ts`), and project creation (`app/state/initial-state.ts`).

### State management

The SPA uses `useReducer` + React Context instead of a server. All mutations are synchronous dispatches — no loaders, no fetchers, no optimistic updates needed. The reducer is at `app/state/reducer.ts`.

On mount, the SPA fetches `GET /api/project` from the CLI server. On save, it posts `POST /api/project`. That's the entire API surface.

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
