import {
  createContext,
  useCallback,
  useContext,
  useReducer,
  useRef,
  useState,
} from 'react'
import { saveActions } from '~/file/api'
import type { BoardAction } from './actions'
import { boardReducer } from './reducer'
import type { BoardState } from './types'

type BoardContextValue = {
  state: BoardState
  dispatch: (action: BoardAction) => void
  isDirty: () => boolean
  savePendingActions: () => Promise<void>
}

const BoardContext = createContext<BoardContextValue | undefined>(undefined)

function BoardProvider({
  initialState,
  children,
}: {
  initialState: BoardState
  children: React.ReactNode
}) {
  const [state, rawDispatch] = useReducer(boardReducer, initialState)
  const pendingActionsRef = useRef<BoardAction[]>([])
  const [pendingCount, setPendingCount] = useState(0)

  const dispatch = useCallback((action: BoardAction) => {
    rawDispatch(action)
    if (action.type === 'LOAD_STATE') return
    pendingActionsRef.current = [...pendingActionsRef.current, action]
    setPendingCount(pendingActionsRef.current.length)
  }, [])

  const isDirty = useCallback(() => pendingCount > 0, [pendingCount])

  const savePendingActions = useCallback(async () => {
    const actions = pendingActionsRef.current
    if (actions.length === 0) return
    pendingActionsRef.current = []

    try {
      const savedState = await saveActions(actions)
      rawDispatch({
        type: 'LOAD_STATE',
        state: pendingActionsRef.current.reduce(boardReducer, savedState),
      })
    } catch (error) {
      pendingActionsRef.current = [...actions, ...pendingActionsRef.current]
      throw error
    } finally {
      setPendingCount(pendingActionsRef.current.length)
    }
  }, [])

  return (
    <BoardContext.Provider
      value={{ state, dispatch, isDirty, savePendingActions }}
    >
      {children}
    </BoardContext.Provider>
  )
}

function useBoardState() {
  const context = useContext(BoardContext)
  if (!context)
    throw new Error('useBoardState must be used within BoardProvider')
  return context.state
}

function useBoardDispatch() {
  const context = useContext(BoardContext)
  if (!context)
    throw new Error('useBoardDispatch must be used within BoardProvider')
  return context.dispatch
}

function useIsDirty() {
  const context = useContext(BoardContext)
  if (!context) throw new Error('useIsDirty must be used within BoardProvider')
  return context.isDirty
}

function useSavePendingActions() {
  const context = useContext(BoardContext)
  if (!context)
    throw new Error('useSavePendingActions must be used within BoardProvider')
  return context.savePendingActions
}

export {
  BoardProvider,
  useBoardDispatch,
  useBoardState,
  useIsDirty,
  useSavePendingActions,
}
