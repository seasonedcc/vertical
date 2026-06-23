import type { BoardAction } from '~/state/actions'
import { actionConflicts } from '~/state/conflict'
import { boardReducer } from '~/state/reducer'
import type { BoardState } from '~/state/types'

type BoardSummary = { id: string; name: string }
type LoadedBoard = { state: BoardState; revision: string }
type ApplyOutcome = {
  status: 'applied' | 'rejected'
  state: BoardState
  revision: string
}
type ChangeEvent = { boardId: string; revision: string }
type ChangeListener = (event: ChangeEvent) => void

type WebhookRequest = {
  headers: Record<string, string | string[] | undefined>
  body: string
}
type WebhookResponse = { status: number; body?: unknown }

type StorageAdapter = {
  listBoards(): Promise<BoardSummary[]>
  loadBoard(id: string): Promise<LoadedBoard>
  applyAction(
    id: string,
    action: BoardAction,
    baseRevision: string
  ): Promise<ApplyOutcome>
  createBoard(name: string): Promise<BoardSummary>
  renameBoard(id: string, name: string): Promise<BoardSummary>
  deleteBoard(id: string): Promise<void>
  subscribe(listener: ChangeListener): () => void
  handleWebhook?(request: WebhookRequest): Promise<WebhookResponse>
}

class StaleWriteError extends Error {}
class BaseUnavailableError extends Error {}

type ApplyPrimitives = {
  load: () => Promise<LoadedBoard>
  loadBase: (revision: string) => Promise<BoardState>
  persist: (state: BoardState, expectedRevision: string) => Promise<string>
}

async function applyActionWith(
  primitives: ApplyPrimitives,
  action: BoardAction,
  baseRevision: string
): Promise<ApplyOutcome> {
  const maxAttempts = 3
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const latest = await primitives.load()

    if (latest.revision !== baseRevision) {
      let base: BoardState
      try {
        base = await primitives.loadBase(baseRevision)
      } catch (error) {
        if (error instanceof BaseUnavailableError) {
          return reject(latest)
        }
        throw error
      }
      if (actionConflicts(action, base, latest.state)) {
        return reject(latest)
      }
    }

    const nextState = boardReducer(latest.state, action)
    try {
      const revision = await primitives.persist(nextState, latest.revision)
      return { status: 'applied', state: nextState, revision }
    } catch (error) {
      if (!(error instanceof StaleWriteError)) throw error
    }
  }

  return reject(await primitives.load())
}

function reject(latest: LoadedBoard): ApplyOutcome {
  return { status: 'rejected', state: latest.state, revision: latest.revision }
}

export { applyActionWith, BaseUnavailableError, StaleWriteError }
export type {
  ApplyOutcome,
  ApplyPrimitives,
  BoardSummary,
  ChangeEvent,
  ChangeListener,
  LoadedBoard,
  StorageAdapter,
  WebhookRequest,
  WebhookResponse,
}
