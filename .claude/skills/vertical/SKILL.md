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

The `new` command auto-registers boards in `~/.vertical/registry.json`. Use `itsvertical list` to find all known boards.

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
itsvertical rename <file> <name>                 # Rename the project
itsvertical open <file>                          # Open in browser UI
```

### Registry

```bash
itsvertical list                                 # List all registered boards
itsvertical list --json                          # List as JSON array
itsvertical register <file>                      # Register an existing .vertical file
itsvertical unregister <name-or-file>            # Remove from registry (keeps file)
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

## Error Handling

When `--json` is passed, errors output as `{"error": "..."}` instead of plain text. Without `--json`, errors print to stderr as `Error: ...`.

## Anti-Patterns

- **Don't hardcode IDs** — always get fresh IDs from `itsvertical show` before operating on entities.
- **Don't forget --json for scripting** — the human-readable output format is not stable; use `--json` for reliable parsing.
- **Don't use `open` (or the `itsvertical <file>` shorthand) in automated workflows** — it starts a browser server meant for human interaction. Use the other commands for agent work.
