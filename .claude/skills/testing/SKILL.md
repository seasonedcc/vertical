---
name: testing
description: Write and run unit tests with Vitest. Use when writing tests, adding test coverage, debugging test failures, or when the user mentions testing, vitest, unit tests, or test-driven development.
---

# Testing

Unit tests use Vitest. Tests are co-located with source files as `*.test.ts`.

## Commands

```bash
pnpm run test          # Run all tests once
pnpm run test:watch    # Run in watch mode
pnpm run test -- app/state/reducer.test.ts  # Run a specific file
```

## Test-Driven Development

Follow the Red-Green-Refactor cycle:

1. **Red** — Write a test that reproduces the issue or validates the new behavior. The test should fail.
2. **Green** — Implement the minimal code to make the test pass.
3. **Refactor** — Clean up the solution while keeping all tests green.

## Core Principles

- **Test the exposed API** — test inputs and outputs, not implementation details
- **Focus on behavior** — assert on what the code does, not how it does it
- **Don't export internal helpers purely for test coverage** — test through the public API
- **Prefer expressive matchers** — use `toContain`, `toContainEqual`, `toEqual` over manual `.some()` or `.find()` checks
- **Assert on specific errors** — when testing failure cases, check the specific error message/type, not just a boolean flag

## Conventions

- Co-locate test files next to the source: `reducer.ts` → `reducer.test.ts`
- Import test utilities explicitly: `import { describe, expect, it } from 'vitest'`
- Use a single `describe` block per subject (function name)
- Use descriptive `it` names that read as sentences
- Follow Biome formatting: 2-space indent, single quotes, semicolons asNeeded, trailing commas es5

## Test Structure

```ts
import { describe, expect, it } from 'vitest'
import { boardReducer } from './reducer'
import type { BoardState } from './types'

describe('boardReducer', () => {
  describe('ACTION_NAME', () => {
    it('does something specific', () => {
      const state: BoardState = { /* minimal fixture */ }
      const result = boardReducer(state, { type: 'ACTION_NAME', /* params */ })
      expect(result.someField).toBe(expectedValue)
    })
  })
})
```

## Fixtures

Build minimal state objects inline using helper functions at the top of each test file:

```ts
function makeState(overrides: Partial<BoardState> = {}): BoardState {
  return {
    project: { id: 'project-1', name: 'Test' },
    slices: [],
    layers: [],
    tasks: [],
    ...overrides,
  }
}
```

Similar helpers for `makeTask`, `makeLayer`, `makeSlice` as needed.

## Path Aliases

The `~/` path alias works in test files:

```ts
import { serialize, deserialize } from '~/file/format'
```

## Running Before Commit

```bash
pnpm run test && pnpm run lint && pnpm run tsc && pnpm run build
```

For concrete test examples, see [references/examples.md](references/examples.md).
