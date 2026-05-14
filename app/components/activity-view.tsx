import { useEffect, useMemo, useState } from 'react'
import type { ActivityEvent, ChangeKind } from '~/file/activity-types'
import { fetchActivity } from '~/file/api'
import { cx } from '~/lib/utils'

const kindMeta: Record<
  ChangeKind,
  { icon: string; label: string; className: string }
> = {
  'project-created': {
    icon: '✨',
    label: 'Created',
    className: 'badge-primary',
  },
  'project-renamed': {
    icon: '✏️',
    label: 'Renamed',
    className: 'badge-warning',
  },
  'slice-named': { icon: '📦', label: 'Box', className: 'badge-info' },
  'slice-renamed': { icon: '✏️', label: 'Box', className: 'badge-warning' },
  'slice-unnamed': { icon: '🚫', label: 'Box', className: 'badge-ghost' },
  'task-added': { icon: '➕', label: 'Added', className: 'badge-ghost' },
  'task-removed': { icon: '🗑', label: 'Removed', className: 'badge-error' },
  'task-completed': { icon: '✅', label: 'Done', className: 'badge-success' },
  'task-uncompleted': {
    icon: '↩️',
    label: 'Reopened',
    className: 'badge-warning',
  },
  'task-renamed': { icon: '✏️', label: 'Renamed', className: 'badge-warning' },
  'task-moved': { icon: '↪️', label: 'Moved', className: 'badge-info' },
  'layer-closed': {
    icon: '🎉',
    label: 'Layer closed',
    className: 'badge-accent',
  },
  'layer-reopened': {
    icon: '↩️',
    label: 'Layer reopened',
    className: 'badge-warning',
  },
  'layer-renamed': {
    icon: '✏️',
    label: 'Layer',
    className: 'badge-warning',
  },
}

const palette = [
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-cyan-500',
  'bg-violet-500',
]

function colorForEmail(email: string) {
  let hash = 0
  for (let i = 0; i < email.length; i++) {
    hash = (hash * 31 + email.charCodeAt(i)) >>> 0
  }
  return palette[hash % palette.length]
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function groupByDay(list: ActivityEvent[]) {
  const groups = new Map<string, ActivityEvent[]>()
  for (const event of list) {
    const day = event.timestamp.slice(0, 10)
    const existing = groups.get(day)
    if (existing) existing.push(event)
    else groups.set(day, [event])
  }
  return Array.from(groups.entries())
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'unavailable'; reason: string }
  | { kind: 'ready'; events: ActivityEvent[] }

function ActivityView() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [authorFilter, setAuthorFilter] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchActivity()
      .then((response) => {
        if (cancelled) return
        if (response.available) {
          setState({ kind: 'ready', events: response.events })
        } else {
          setState({ kind: 'unavailable', reason: response.reason })
        }
      })
      .catch((error: Error) => {
        if (cancelled) return
        setState({ kind: 'error', message: error.message })
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (state.kind === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center bg-base-200">
        <span className="loading loading-spinner loading-lg" />
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className="flex flex-1 items-center justify-center bg-base-200 p-6">
        <div className="max-w-md rounded-lg bg-base-100 p-6 text-center shadow">
          <p className="font-semibold text-red-600">Could not load activity</p>
          <p className="mt-2 text-base-content/70 text-sm">{state.message}</p>
        </div>
      </div>
    )
  }

  if (state.kind === 'unavailable') {
    return (
      <div className="flex flex-1 items-center justify-center bg-base-200 p-6">
        <div className="max-w-md rounded-lg bg-base-100 p-6 text-center shadow">
          <p className="font-semibold">Activity isn't available here</p>
          <p className="mt-2 text-base-content/70 text-sm">{state.reason}</p>
          <p className="mt-4 text-base-content/50 text-xs">
            The activity feed is reconstructed from git history. Track the
            .vertical file in git to enable it.
          </p>
        </div>
      </div>
    )
  }

  return (
    <ActivityFeed
      events={state.events}
      authorFilter={authorFilter}
      setAuthorFilter={setAuthorFilter}
    />
  )
}

type ActivityFeedProps = {
  events: ActivityEvent[]
  authorFilter: string | null
  setAuthorFilter: (value: string | null) => void
}

function ActivityFeed({
  events,
  authorFilter,
  setAuthorFilter,
}: ActivityFeedProps) {
  const contributors = useMemo(() => {
    const map = new Map<string, { name: string; email: string }>()
    for (const event of events) {
      if (!map.has(event.email)) {
        map.set(event.email, { name: event.author, email: event.email })
      }
    }
    return Array.from(map.values())
  }, [events])

  const filtered = useMemo(() => {
    if (!authorFilter) return events
    return events.filter((event) => event.email === authorFilter)
  }, [events, authorFilter])

  const completedCount = useMemo(
    () =>
      filtered.reduce(
        (acc, event) =>
          acc +
          event.changes.filter((change) => change.kind === 'task-completed')
            .length,
        0
      ),
    [filtered]
  )

  if (events.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-base-200 p-6">
        <div className="max-w-md rounded-lg bg-base-100 p-6 text-center shadow">
          <p className="font-semibold">No activity yet</p>
          <p className="mt-2 text-base-content/70 text-sm">
            Commit this .vertical file to git to start tracking activity.
          </p>
        </div>
      </div>
    )
  }

  const oldest = filtered[filtered.length - 1]
  const newest = filtered[0]

  return (
    <div className="flex-1 overflow-y-auto bg-base-200">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <header className="mb-8">
          <p className="text-base-content/50 text-sm uppercase tracking-wide">
            Activity
          </p>
          <h1 className="mt-1 font-bold text-3xl">Project changelog</h1>
          <p className="mt-2 text-base-content/70">
            Reconstructed from git history.
          </p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <Stat label="Tasks done" value={completedCount} />
            <Stat label="Contributors" value={contributors.length} />
            <Stat label="Events" value={filtered.length} />
          </div>

          {oldest && newest && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-base-content/60 text-sm">
              <span>From</span>
              <span className="font-medium text-base-content">
                {formatDate(oldest.timestamp)} {formatTime(oldest.timestamp)}
              </span>
              <span>to</span>
              <span className="font-medium text-base-content">
                {formatDate(newest.timestamp)} {formatTime(newest.timestamp)}
              </span>
            </div>
          )}
        </header>

        <div className="flex flex-wrap items-center gap-2 border-base-300 border-b pb-4">
          <span className="text-base-content/50 text-sm">Filter:</span>
          <button
            type="button"
            className={cx(
              'badge badge-sm cursor-pointer',
              authorFilter === null ? 'badge-primary' : 'badge-outline'
            )}
            onClick={() => setAuthorFilter(null)}
          >
            All
          </button>
          {contributors.map((contributor) => (
            <button
              type="button"
              key={contributor.email}
              className={cx(
                'badge badge-sm cursor-pointer',
                authorFilter === contributor.email
                  ? 'badge-primary'
                  : 'badge-outline'
              )}
              onClick={() =>
                setAuthorFilter(
                  authorFilter === contributor.email ? null : contributor.email
                )
              }
            >
              {contributor.name}
            </button>
          ))}
        </div>

        <div className="mt-8 space-y-10">
          {groupByDay(filtered).map(([day, group]) => (
            <section key={day}>
              <div className="-mx-6 sticky top-0 z-10 mb-4 bg-base-200/80 px-6 py-2 backdrop-blur">
                <h2 className="font-semibold text-base-content/70 text-sm uppercase tracking-wide">
                  {formatDate(group[0].timestamp)}
                </h2>
              </div>

              <ol className="relative">
                <div className="absolute top-2 bottom-2 left-5 w-px bg-base-300" />
                {group.map((event) => (
                  <li
                    key={event.hash}
                    className="relative mb-8 pl-14 last:mb-0"
                  >
                    <div
                      className={cx(
                        'absolute left-0 flex h-10 w-10 items-center justify-center rounded-full font-semibold text-sm text-white shadow-md',
                        colorForEmail(event.email)
                      )}
                      title={event.author}
                    >
                      {initials(event.author)}
                    </div>

                    <div className="rounded-lg border border-base-300 bg-base-100 p-4 shadow-sm">
                      <header className="mb-3 flex items-baseline gap-2">
                        <span className="font-semibold">{event.author}</span>
                        <span className="text-base-content/50 text-xs">
                          {formatTime(event.timestamp)}
                        </span>
                      </header>

                      <ul className="space-y-2">
                        {event.changes.map((change, idx) => {
                          const meta = kindMeta[change.kind]
                          return (
                            <li
                              key={`${event.hash}-${idx}`}
                              className="flex items-start gap-2 text-sm"
                            >
                              <span
                                className={cx(
                                  'badge badge-sm shrink-0',
                                  meta.className
                                )}
                              >
                                <span className="mr-1">{meta.icon}</span>
                                {meta.label}
                              </span>
                              <span className="leading-relaxed">
                                {change.text}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-base-100 p-4 shadow-sm">
      <div className="text-base-content/50 text-xs uppercase tracking-wide">
        {label}
      </div>
      <div className="mt-1 font-bold text-2xl">{value}</div>
    </div>
  )
}

export { ActivityView }
