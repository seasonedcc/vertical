import { useCallback, useEffect, useReducer, useState } from 'react'
import { applyAction, loadBoard, subscribeToEvents } from '~/file/api'
import type { LoadedBoard } from '~/file/api'
import type { BoardAction } from '~/state/actions'
import { boardReducer } from '~/state/reducer'
import { initialSyncState, syncReducer } from './sync-reducer'

function useBoardSync(boardId: string, initialBoard: LoadedBoard) {
  const [state, rawDispatch] = useReducer(boardReducer, initialBoard.state)
  const [sync, syncDispatch] = useReducer(
    syncReducer,
    initialBoard.revision,
    initialSyncState
  )
  const [disconnected, setDisconnected] = useState(false)

  const dispatch = useCallback((action: BoardAction) => {
    rawDispatch(action)
    syncDispatch({ type: 'ENQUEUE', action })
  }, [])

  useEffect(() => {
    const action = sync.inFlight
    if (!action) return

    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    applyAction(boardId, action, sync.baseRevision)
      .then((outcome) => {
        if (cancelled) return
        if (outcome.status === 'rejected') {
          rawDispatch({ type: 'LOAD_STATE', state: outcome.state })
          syncDispatch({ type: 'REJECTED', revision: outcome.revision })
        } else {
          syncDispatch({ type: 'SENT', revision: outcome.revision })
        }
      })
      .catch(() => {
        if (cancelled) return
        retryTimer = setTimeout(() => syncDispatch({ type: 'RETRY' }), 1000)
      })

    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [sync.sendId, boardId])

  useEffect(() => {
    if (!sync.remotePending) return
    if (sync.inFlight || sync.queue.length > 0) return

    let cancelled = false
    loadBoard(boardId)
      .then((loaded) => {
        if (cancelled) return
        rawDispatch({ type: 'LOAD_STATE', state: loaded.state })
        syncDispatch({ type: 'RECONCILED', revision: loaded.revision })
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [sync.remotePending, sync.inFlight, sync.queue.length, boardId])

  useEffect(() => {
    return subscribeToEvents(
      (event) => {
        if (event.boardId !== boardId) return
        syncDispatch({ type: 'REMOTE', revision: event.revision })
      },
      () => setDisconnected(true)
    )
  }, [boardId])

  return {
    state,
    dispatch,
    syncing: sync.inFlight !== null || sync.queue.length > 0,
    conflict: sync.conflictAt,
    disconnected,
  }
}

export { useBoardSync }
