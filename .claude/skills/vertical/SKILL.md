---
name: vertical
description: Manage projects with the Vertical board using the itsvertical CLI. Create projects, add tasks, organize boxes, split layers, and track progress. Use when the user mentions Vertical, project management, boxes, slices, .vertical files, or itsvertical.
---

# Vertical

File-based project management with vertical slicing. The CLI command is `itsvertical` (npm package: `itsvertical`).

## Setup

Before using any commands, check if `itsvertical` is available:

```bash
itsvertical --version
```

If not found, install it globally:

```bash
npm install -g itsvertical
```

## Core Workflow

When working on a task, always read its notes first with `itsvertical task notes <file> <task-id>`. Notes contain important context, requirements, and decisions about the work.

Every Vertical project follows this pattern:

```bash
itsvertical new project.vertical "Project Name"   # create a project
itsvertical show project.vertical                  # see the board with IDs
itsvertical box rename project.vertical <id> "Box Name"  # name a box
itsvertical task add project.vertical <layer-id> "Task name"  # add tasks
itsvertical task done project.vertical <task-id>   # mark done
itsvertical project.vertical                        # view in browser (shorthand for "open")
```

The `new` and `open` commands automatically track boards in `~/.vertical/history.json`. Use `itsvertical history list` to find all known boards.

## Key Concepts

- **Project**: a single `.vertical` file containing the full board state
- **Boxes** (slices): 9 boxes numbered 1-9. Each represents a vertical slice of work.
- **Layers**: steps within a box. A box starts with one layer. Split to create phases (e.g., "Design" then "Build").
- **Tasks**: work items within a layer. Can be marked done, renamed, moved, reordered. Each task can have rich text notes (`notesHtml`).

## All Commands

All entities are addressed by UUID. Use `itsvertical show` to get IDs. Every command accepts `--json` to output the full board state as JSON.

### Project

```bash
itsvertical <file>                               # Shorthand for "open"
itsvertical new <path> <name>                    # Create a new .vertical file
itsvertical show <file>                          # Print board with IDs
itsvertical show <file> --json                   # Output board as JSON
itsvertical show <file> --box <slice-id>         # Show only one box
itsvertical show <file> --visual                 # Show visual 3x3 grid with summary table
itsvertical show <file> --summary                # Counts per box and layer in a few lines
itsvertical apply <file> <plan.json>             # Fill empty boxes from a plan in one call
itsvertical validate <file>                      # Check statuses and blockers, exit 1 on problems
itsvertical inbox <file>                         # Tasks edited in the browser, not yet acknowledged
itsvertical log <file> --since <iso-time> --json  # What changed after a moment, with actor and time
itsvertical rename <file> <name>                 # Rename the project
itsvertical open <file>                          # Open in browser UI
```

### History

```bash
itsvertical history list                         # List all known boards
itsvertical history list --json                  # List as JSON array
itsvertical history add <file>                   # Manually add a board to history
itsvertical history remove <name-or-file>        # Remove from history (keeps file)
```

### Tasks

```bash
itsvertical task add <file> <layer-id> <name>    # Add task to end of layer
itsvertical task add <file> <layer-id> <name> --after <task-id>  # Insert after specific task
itsvertical task done <file> <task-id>           # Mark as done
itsvertical task undone <file> <task-id>         # Mark as not done
itsvertical task rename <file> <task-id> <name>  # Rename
itsvertical task delete <file> <task-id>         # Delete
itsvertical task move <file> <task-id> <layer-id>  # Move to another layer
itsvertical task notes <file> <task-id>           # Print task notes
itsvertical task notes <file> <task-id> --set <html>  # Set notes (HTML)
itsvertical task notes <file> <task-id> --clear   # Clear notes
itsvertical task status <file> <task-id> active --by <who>       # Someone is working on it
itsvertical task status <file> <task-id> failed --reason <text>  # It failed, and why
itsvertical task status <file> <task-id> blocked --on <task-id...>  # It waits on other tasks
itsvertical task status <file> <task-id> none     # Clear the status
itsvertical task link <file> <task-id> <label> <target>  # Attach a link, replacing the same label
itsvertical task unlink <file> <task-id> <label>  # Remove a link
itsvertical task ack <file> <task-id>             # Acknowledge a task edited in the browser
```

### Boxes

```bash
itsvertical box rename <file> <slice-id> <name>  # Rename a box
itsvertical box clear <file> <slice-id>          # Clear box name
itsvertical box swap <file> <id-1> <id-2>        # Swap two box positions
```

### Layers

```bash
itsvertical layer split <file> <task-id>         # Split at task (tasks after go to new layer)
itsvertical layer merge <file> <layer-id>        # Merge with next layer
itsvertical layer rename <file> <layer-id> <name>  # Rename
itsvertical layer clear <file> <layer-id>        # Clear name
itsvertical layer status <file> <layer-id> done  # Set status to done
itsvertical layer status <file> <layer-id> none  # Clear status
```

## Common Patterns

### Set up a project with named boxes

```bash
itsvertical new project.vertical "Online Course Platform"
itsvertical show project.vertical  # get slice IDs
itsvertical box rename project.vertical <id1> "Course Catalog"
itsvertical box rename project.vertical <id2> "Video Player"
itsvertical box rename project.vertical <id3> "Progress Tracking"
```

### Add tasks to a box

```bash
itsvertical show project.vertical --box <slice-id>  # get the layer ID
itsvertical task add project.vertical <layer-id> "Create mockups"
itsvertical task add project.vertical <layer-id> "Review with team"
itsvertical task add project.vertical <layer-id> "Finalize design"
```

### Split a box into phases

```bash
# Split after "Review with team" — tasks after it go to a new layer
itsvertical layer split project.vertical <review-task-id>
itsvertical layer rename project.vertical <first-layer-id> "Draft"
itsvertical layer rename project.vertical <new-layer-id> "Polish"
```

### Track progress with --json

```bash
# Get structured state for programmatic use
itsvertical show project.vertical --json
```

The JSON output contains the full board: project, slices (sorted by boxNumber), layers, and tasks with all IDs.

### View the board as a grid

```bash
itsvertical show project.vertical --visual
```

The grid shows all 9 boxes with their tasks, layer structure, and a summary table — useful for a quick overview without opening the browser UI.

### Move a task between boxes

```bash
# Move a task from one box's layer to another box's layer
itsvertical task move project.vertical <task-id> <target-layer-id>
```

### Seed a whole board in one call

Write a plan file and apply it. Each box in the plan must be empty.

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

```bash
itsvertical apply project.vertical plan.json --json --brief
```

The brief output maps every task `key` to the id it became. A task may also carry `done`, `status`, `reason`, `assignee`, `notesHtml` and `links`.

### Track work in progress

```bash
itsvertical task status project.vertical <task-id> active --by "opus"
itsvertical task status project.vertical <task-id> failed --reason "gates red"
itsvertical task link project.vertical <task-id> PR https://github.com/org/repo/pull/12
itsvertical task done project.vertical <task-id>   # clears the status, unblocks waiting tasks
itsvertical show project.vertical --summary         # the cheap way to read progress
```

### Say who you are

Every change is recorded with an actor. Pass `--actor <name>` on a mutation, or set `VERTICAL_ACTOR` once for the session, so the log tells agents and people apart.

```bash
VERTICAL_ACTOR=orchestrator itsvertical task done project.vertical <task-id>
itsvertical log project.vertical --limit 10
```

### Pick up what a person changed in the browser

When the board was opened with `itsvertical open <file> --inbox`, tasks the person adds or edits are flagged.

```bash
itsvertical inbox project.vertical --json
itsvertical task ack project.vertical <task-id>
```

## Error Handling

When `--json` is passed, errors output as `{"error": "..."}` instead of plain text. Without `--json`, errors print to stderr as `Error: ...`.

## Anti-Patterns

- **Don't track boards that belong to a repository** — a board committed with a project is opened from many checkouts, and the history allows one path per name. Create and open those with `--no-track`.
- **Don't hardcode IDs** — always get fresh IDs from `itsvertical show` before operating on entities.
- **Don't read the whole board after every change** — pass `--json --brief` on mutations and use `show --summary` to check progress; the full `--json` board is for when you need ids.
- **Don't forget --json for scripting** — the human-readable output format is not stable; use `--json` for reliable parsing.
- **Don't suggest `open` without `--read-only` while an agent owns the board** — a person watching a build should not be able to tick tasks; use `--inbox` when they should be able to add requests.
- **Don't use `open` (or the `itsvertical <file>` shorthand) in automated workflows** — it starts a browser server meant for human interaction. Use the other commands for agent work.
