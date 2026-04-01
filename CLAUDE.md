# Agent Guidelines

Vertical is a file-based project management tool with a CLI (`itsvertical`) and a browser-based board UI. The npm package name is `itsvertical`. No server, no database, no auth — just `.vertical` files.

## Architecture

The project has two parts:

- **SPA** (`app/`) — React app built with Vite. The board UI. Built to `dist/`.
- **CLI** (`cli/`) — Node.js CLI built with tsup. Provides commands for managing `.vertical` files and a local HTTP server for the browser UI. Built to `cli/dist/`.

The CLI and SPA share code: types (`app/state/types.ts`), serialization (`app/file/format.ts`), project creation (`app/state/initial-state.ts`), and the reducer (`app/state/reducer.ts`).

### State management

The SPA uses `useReducer` + React Context. All mutations are synchronous dispatches — no loaders, no fetchers, no optimistic updates. The reducer at `app/state/reducer.ts` is the single source of truth for all business logic, used by both the SPA and the CLI.

The browser UI communicates with the CLI server via two endpoints:
- `GET /api/project` — load the `.vertical` file
- `POST /api/project` — save back to the file

### CLI structure

- `cli/index.ts` — commander-based entry point with all commands
- `cli/server.ts` — HTTP server (static file serving + API)
- `cli/apply.ts` — shared helpers: load, save, apply reducer action, output formatting
- `cli/history.ts` — board history (`~/.vertical/history.json`) for tracking known boards
- `cli/show.ts` — human-readable and JSON board display

All CLI commands follow the same pattern: read file → deserialize → apply reducer action → serialize → write file. The `applyAction` helper in `cli/apply.ts` encapsulates this.

### Board history

The `new` and `open` commands automatically track boards in `~/.vertical/history.json`. Use `itsvertical history list` to see all known boards, `itsvertical history add <file>` to manually add a board, and `itsvertical history remove <name-or-file>` to remove one.

## Essential Commands

```bash
pnpm install          # Install dependencies
pnpm run dev          # Start dev environment (Vite HMR + CLI auto-restart)
pnpm run build        # Build both SPA (vite) and CLI (tsup)
pnpm run build:cli    # Build only the CLI
pnpm run test         # Run all unit tests
pnpm run test:watch   # Run tests in watch mode
pnpm run tsc          # Type-check
pnpm run lint         # Check code style with Biome
pnpm run lint-fix     # Auto-fix linting and formatting
```

### Dev

`pnpm run dev` starts the full dev environment:
- Creates `dev.vertical` from `sample.vertical` on first run (preserved across restarts)
- Vite dev server with HMR at `http://localhost:4007`
- CLI server on port 3456 (auto-restarts on CLI source changes)
- Vite proxies `/api/*` to the CLI server

### Test locally

```bash
pnpm run build
pnpm run itsvertical -- new test.vertical "Test Project"
pnpm run itsvertical -- show test.vertical
pnpm run itsvertical -- test.vertical
```

### Publish

```bash
pnpm run build
npm publish
```

## Tooling

- **Package manager:** pnpm
- **Node version:** >=20
- **Linting & formatting:** [Biome](https://biomejs.dev). Check with `pnpm run lint`, fix with `pnpm run lint-fix`.
- **Type checking:** `pnpm run tsc`
- **SPA build:** Vite
- **CLI build:** tsup (bundles `cli/index.ts` with `~` alias resolved to `./app/`)
- **Testing:** [Vitest](https://vitest.dev). Run with `pnpm run test`.
- **Styling:** Tailwind CSS + DaisyUI

## TypeScript Guidelines

- Use `type` instead of `interface` (prefer type aliases)
- Use TypeScript's inference where possible, but define types for component props
- Only add type annotations when required by strict mode or for clarity
- Avoid `any` — use proper types or `unknown` as a last resort
- Do not add return types to functions unless strictly necessary

## Coding Style

- Do not add comments to the code unless it's an incredibly complex operation
- Source files are TypeScript ESM modules
- Formatting is handled by Biome:
  - 2 space indentation
  - Single quotes
  - Trailing commas where valid
  - Semicolons only when required (`semicolons: "asNeeded"`)
- Avoid abbreviations when naming things
- Avoid Hasty Abstractions: repeat things until the right abstraction emerges
- Only extract new components if you need to reuse them or call hooks
- Only extract abstractions to new files if you need to share them among more than one file
- Run `pnpm run lint-fix` before committing

## Agent-First CLI Design

The CLI is designed for AI agents as the primary user:

- **IDs everywhere**: all entities (slices, layers, tasks) are addressed by UUID
- **All output includes IDs**: `itsvertical show` prints IDs for every entity
- **`--json` on every command**: outputs the full board state as JSON after any mutation
- **JSON errors**: when `--json` is passed, errors output `{"error": "..."}` instead of plain text
- **Deterministic**: same input, same output. No prompts, no interactivity.

## Data Model

- **Project**: `{ id, name }` — the top-level entity
- **Slices** (boxes): `{ id, projectId, boxNumber (1-9), name }` — each box is a vertical slice of work
- **Layers**: `{ id, sliceId, name, sorting, status }` — steps within a box (can be split/merged)
- **Tasks**: `{ id, projectId, layerId, name, sorting, done, notesHtml }` — work items within a layer. `notesHtml` is rich text (HTML string or null).

## Definition of Done

- A task is not done unless `pnpm run test`, `pnpm run lint`, `pnpm run tsc`, and `pnpm run build` all pass.
- A task is not done if it has leftover comments.
- Run `pnpm run lint-fix` before committing.

## Fixing Bugs

Follow a test-driven approach:
1. **Red** — Write a test that reproduces the issue and fails.
2. **Green** — Implement the minimal fix so the new test passes.
3. **Refactor** — Clean up while keeping all tests green.

## Additional Warnings

- DO NOT change React dependency arrays just to make the linter happy. You'll create infinite render loops. Only add things to dependency arrays when they really need to be there.
- DO NOT add backwards compatibility unless explicitly required.
