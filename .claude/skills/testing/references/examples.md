# Testing Examples

Concrete examples demonstrating testing patterns used in this project.

## Table of Contents

- [Reducer Testing](#reducer-testing)
- [Serialization Testing](#serialization-testing)
- [Initial State Testing](#initial-state-testing)

## Reducer Testing

The reducer (`app/state/reducer.ts`) is a pure function — given a `BoardState` and a `BoardAction`, it returns a new `BoardState`. Each action type gets its own `describe` block.

### Example: Testing a simple setter action

```ts
import { describe, expect, it } from 'vitest'
import { boardReducer } from './reducer'
import type { BoardState, Layer, Slice, Task } from './types'

function makeState(overrides: Partial<BoardState> = {}): BoardState {
  return {
    project: { id: 'project-1', name: 'Test Project' },
    slices: [],
    layers: [],
    tasks: [],
    ...overrides,
  }
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    projectId: 'project-1',
    layerId: 'layer-1',
    name: 'Task 1',
    sorting: 1,
    done: false,
    notesHtml: null,
    ...overrides,
  }
}

describe('boardReducer', () => {
  describe('SET_TASK_DONE', () => {
    it('marks a task as done', () => {
      const state = makeState({
        tasks: [makeTask({ id: 'task-1', done: false })],
      })
      const result = boardReducer(state, {
        type: 'SET_TASK_DONE',
        taskId: 'task-1',
        done: true,
      })
      expect(result.tasks[0].done).toBe(true)
    })
  })
})
```

### Example: Testing a complex action with sorting logic

```ts
describe('CREATE_TASK_AFTER', () => {
  it('places a new task between two existing tasks', () => {
    const state = makeState({
      tasks: [
        makeTask({ id: 'task-1', sorting: 1 }),
        makeTask({ id: 'task-2', sorting: 3 }),
      ],
    })
    const result = boardReducer(state, {
      type: 'CREATE_TASK_AFTER',
      id: 'task-new',
      afterTaskId: 'task-1',
    })
    expect(result.tasks).toHaveLength(3)
    const newTask = result.tasks.find((t) => t.id === 'task-new')
    expect(newTask?.sorting).toBe(2)
  })

  it('returns state unchanged when afterTaskId is not found', () => {
    const state = makeState({ tasks: [makeTask()] })
    const result = boardReducer(state, {
      type: 'CREATE_TASK_AFTER',
      id: 'task-new',
      afterTaskId: 'nonexistent',
    })
    expect(result).toBe(state)
  })
})
```

**Key patterns:**
- Use `toBe(state)` (reference equality) to verify no-op cases
- Test edge cases: not found, last item, between items
- Build minimal fixtures that only include what the action needs

## Serialization Testing

Tests for `serialize` and `deserialize` in `app/file/format.ts`.

### Example: Round-trip test

```ts
import { describe, expect, it } from 'vitest'
import type { BoardState } from '~/state/types'
import { deserialize, serialize } from './format'

describe('round-trip', () => {
  it('preserves state through serialize then deserialize', () => {
    const state: BoardState = {
      project: { id: 'project-1', name: 'Test' },
      slices: [{ id: 'slice-1', projectId: 'project-1', boxNumber: 1, name: null }],
      layers: [{ id: 'layer-1', sliceId: 'slice-1', name: null, sorting: 1, status: null }],
      tasks: [{
        id: 'task-1', projectId: 'project-1', layerId: 'layer-1',
        name: 'Task 1', sorting: 1, done: false, notesHtml: null,
      }],
    }
    const result = deserialize(serialize(state))
    expect(result).toEqual(state)
  })
})
```

### Example: Testing error cases

```ts
describe('deserialize', () => {
  it('throws on wrong version', () => {
    const json = JSON.stringify({
      version: 2, project: { id: 'p', name: 'P' },
      slices: [], layers: [], tasks: [],
    })
    expect(() => deserialize(json)).toThrow('Unsupported file version: 2')
  })

  it('throws on missing required fields', () => {
    const json = JSON.stringify({ version: 1, project: { id: 'p', name: 'P' } })
    expect(() => deserialize(json)).toThrow('missing required fields')
  })
})
```

**Key patterns:**
- Use `toEqual` for deep equality (not `toBe`)
- Use `toThrow` with specific error message strings
- Test normalization logic (e.g., missing `notesHtml` → `null`)

## Initial State Testing

Tests for `createBlankProject` in `app/state/initial-state.ts`.

### Example: Structural assertions

```ts
import { describe, expect, it } from 'vitest'
import { createBlankProject } from './initial-state'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

describe('createBlankProject', () => {
  it('creates a project with the given name', () => {
    const state = createBlankProject('My Project')
    expect(state.project.name).toBe('My Project')
  })

  it('creates exactly 9 slices with box numbers 1-9', () => {
    const state = createBlankProject('Test')
    expect(state.slices).toHaveLength(9)
    const boxNumbers = state.slices.map((s) => s.boxNumber).sort()
    expect(boxNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('creates unique IDs across all entities', () => {
    const state = createBlankProject('Test')
    const allIds = [
      state.project.id,
      ...state.slices.map((s) => s.id),
      ...state.layers.map((l) => l.id),
    ]
    expect(new Set(allIds).size).toBe(allIds.length)
  })
})
```

**Key patterns:**
- Use regex for UUID validation
- Test structural invariants (count, uniqueness, relationships)
- Don't assert on exact IDs since they're random
