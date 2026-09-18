import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState } from 'react'
import { fetchLog } from '~/file/api'
import { cx } from '~/lib/utils'
import { useBoardState } from '~/state/context'
import type { BoardEvent } from '~/state/types'

function formatTime(at: string) {
  return new Date(at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ActivityDrawer({ onClose }: { onClose: () => void }) {
  const state = useBoardState()
  const [events, setEvents] = useState<BoardEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchLog()
      .then((loaded) => setEvents([...loaded].reverse()))
      .catch((err) => setError(err.message))
  }, [state])

  return (
    <Dialog.Root open onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 isolate z-40 animate-fade-in bg-base-300/75" />
        <Dialog.Content
          className={cx(
            'fixed top-0 right-0 isolate z-40 flex h-full w-full flex-col gap-4 overflow-y-auto bg-base-100 p-6 shadow-xl',
            'animate-slide-in-right md:w-1/2 md:max-w-xl'
          )}
        >
          <div className="relative">
            <Dialog.Title className="h1">Activity</Dialog.Title>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-square absolute top-0 right-0"
              onClick={onClose}
            >
              ✕
            </button>
            <Dialog.Description className="sr-only">
              Every change made to this board, newest first
            </Dialog.Description>
          </div>
          {error && <p className="text-error text-sm">{error}</p>}
          {events?.length === 0 && (
            <p className="text-base-content/60 text-sm">
              Nothing has been recorded yet.
            </p>
          )}
          <ol className="flex flex-col gap-3">
            {events?.map((event) => (
              <li key={event.id} className="flex flex-col gap-0.5 text-sm">
                <span>{event.summary}</span>
                <span className="text-base-content/50 text-xs">
                  {formatTime(event.at)} · {event.actor}
                </span>
              </li>
            ))}
          </ol>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export { ActivityDrawer }
