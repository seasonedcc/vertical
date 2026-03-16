# Vertical

**Tickets pile up, scopes get done. Project work isn't linear, it's Vertical.**

Vertical is a file-based project management tool built around the nine-box grid. No accounts, no cloud, no setup. Just a `.vertical` file and your terminal.

```
npx itsvertical new my-project.vertical "My Project"
```

## Built for AI agents

Vertical is designed to be used through AI coding agents like [Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview). The CLI is the primary interface — every entity is addressed by ID, every command accepts `--json` for structured output, and errors are machine-readable. An agent can create a project, break work into scopes, add tasks, and track progress — all through the command line.

The browser UI (`itsvertical open`) is there for when you want to see the board visually, drag things around, or get a quick overview.

## How it works

Vertical organizes work into a 3x3 grid of boxes. Each box can hold tasks, and each box can be split into layers (steps). Tasks move between boxes, layers break work into phases, and things get marked done as you go.

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
itsvertical new <path> <name>                   # Create a new .vertical file
itsvertical open <file>                         # Open in the browser UI
itsvertical show <file>                         # Print the board to the terminal
itsvertical show <file> --json                  # Output the board as JSON
itsvertical show <file> --box <slice-id>        # Show only a specific box
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

### Browser UI

`itsvertical open` starts a local server and opens the board in your browser. Click **Save** or press **Ctrl+S** / **Cmd+S** to write changes back to the file.

## The nine-box grid

The board is a 3x3 grid. Each box represents a scope of work.

- **Name boxes** by clicking the title area
- **Drag boxes** to rearrange them in the grid
- **Add tasks** by clicking the input at the bottom of a box
- **Edit tasks** by clicking on them
- **Mark tasks done** with the circle checkbox
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
| **Ctrl/Cmd+S** | Save to file |

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

- **SPA** (`app/`) — A React app built with Vite. This is the nine-box board UI. Built to `dist/`.
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

### Test locally

```
pnpm run build
pnpm run itsvertical -- new test-project.vertical "Test Project"
pnpm run itsvertical -- open test-project.vertical
```

### Lint and type-check

```
pnpm run tsc
pnpm run lint
```

### Publish

```
pnpm run build
npm publish
```

The `files` field in `package.json` includes only `cli/dist` and `dist` — the built outputs. Source files are not published.

## Credits

Made by [Ryan Singer](https://ryansinger.co) and [Seasoned](https://www.seasoned.cc).

## License

MIT
