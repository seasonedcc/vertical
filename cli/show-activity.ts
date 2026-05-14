import path from 'node:path'
import type { ActivityEvent, ChangeKind } from '~/file/activity-types'

const ANSI = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
}

const colorEnabled = process.stdout.isTTY && !process.env.NO_COLOR
function color(code: string, text: string) {
  return colorEnabled ? `${code}${text}${ANSI.reset}` : text
}

const ESC = String.fromCharCode(27)
const ANSI_RE = new RegExp(`${ESC}\\[[0-9;]*m`, 'g')
function visibleLength(s: string) {
  return s.replace(ANSI_RE, '').length
}

const kindIcon: Record<ChangeKind, string> = {
  'project-created': '✨',
  'project-renamed': '✏️ ',
  'slice-named': '📦',
  'slice-renamed': '✏️ ',
  'slice-unnamed': '🚫',
  'task-added': '➕',
  'task-removed': '🗑',
  'task-completed': '✅',
  'task-uncompleted': '↩️ ',
  'task-renamed': '✏️ ',
  'task-moved': '↪️ ',
  'layer-closed': '🎉',
  'layer-reopened': '↩️ ',
  'layer-renamed': '✏️ ',
}

function formatTime(iso: string) {
  const date = new Date(iso)
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  return `${hh}:${mi}`
}

function formatDuration(startIso: string, endIso: string) {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime()
  const totalMin = Math.max(0, Math.floor(ms / 60000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

function firstName(fullName: string) {
  return fullName.split(' ')[0]
}

function truncate(text: string, width: number) {
  if (visibleLength(text) <= width) return text
  return `${text.slice(0, Math.max(1, width - 1))}…`
}

function padCell(text: string, width: number) {
  const pad = width - visibleLength(text)
  return pad > 0 ? text + ' '.repeat(pad) : text
}

function printTable(headers: string[], rows: string[][], maxWidths: number[]) {
  const widths = headers.map((h, i) => {
    const dataMax = Math.max(
      visibleLength(h),
      ...rows.map((r) => visibleLength(r[i] ?? ''))
    )
    return Math.min(dataMax, maxWidths[i])
  })

  const renderSep = (left: string, mid: string, right: string) =>
    left + widths.map((w) => '─'.repeat(w + 2)).join(mid) + right

  const renderRow = (cells: string[]) =>
    `│ ${cells
      .map((cell, i) => padCell(truncate(cell, widths[i]), widths[i]))
      .join(' │ ')} │`

  console.log(`  ${renderSep('┌', '┬', '┐')}`)
  console.log(`  ${renderRow(headers.map((h) => color(ANSI.bold, h)))}`)
  console.log(`  ${renderSep('├', '┼', '┤')}`)
  for (const row of rows) {
    console.log(`  ${renderRow(row)}`)
  }
  console.log(`  ${renderSep('└', '┴', '┘')}`)
}

type Completion = {
  time: string
  text: string
  author: string
  kind: ChangeKind
}

function collectCompletions(eventsOldestFirst: ActivityEvent[]): Completion[] {
  const completions: Completion[] = []
  for (const event of eventsOldestFirst) {
    const time = formatTime(event.timestamp)
    const author = firstName(event.author)
    for (const change of event.changes) {
      if (change.kind === 'task-completed' || change.kind === 'layer-closed') {
        completions.push({ time, text: change.text, author, kind: change.kind })
      }
    }
  }
  return completions
}

type Contributor = {
  email: string
  name: string
  completed: number
  layersClosed: number
  firstActivity: string
  lastActivity: string
}

function collectContributors(
  eventsOldestFirst: ActivityEvent[]
): Contributor[] {
  const map = new Map<string, Contributor>()
  for (const event of eventsOldestFirst) {
    const time = formatTime(event.timestamp)
    let entry = map.get(event.email)
    if (!entry) {
      entry = {
        email: event.email,
        name: event.author,
        completed: 0,
        layersClosed: 0,
        firstActivity: time,
        lastActivity: time,
      }
      map.set(event.email, entry)
    } else {
      entry.lastActivity = time
    }
    for (const change of event.changes) {
      if (change.kind === 'task-completed') entry.completed++
      else if (change.kind === 'layer-closed') entry.layersClosed++
    }
  }
  return Array.from(map.values()).sort(
    (a, b) =>
      b.completed + b.layersClosed - (a.completed + a.layersClosed) ||
      a.firstActivity.localeCompare(b.firstActivity)
  )
}

function formatContributorScore(contributor: Contributor) {
  if (contributor.layersClosed === 0) return String(contributor.completed)
  const noun = contributor.layersClosed === 1 ? 'layer closed' : 'layers closed'
  return `${contributor.completed} + ${contributor.layersClosed} ${noun}`
}

function rule(width: number) {
  return '─'.repeat(width)
}

function showActivity(events: ActivityEvent[], filePath?: string) {
  const filename = filePath ? path.basename(filePath) : null
  const width = Math.min(process.stdout.columns ?? 80, 80)
  const ruleLine = rule(width - 2)

  console.log()
  console.log(`  ${color(ANSI.dim, ruleLine)}`)
  const title = filename
    ? `📅 Activity Timeline — ${color(ANSI.bold, filename)}`
    : `📅 ${color(ANSI.bold, 'Activity Timeline')}`
  console.log(`   ${title}`)
  console.log(`  ${color(ANSI.dim, ruleLine)}`)
  console.log()

  if (events.length === 0) {
    console.log('  No activity yet for this file.')
    console.log()
    return
  }

  const oldestFirst = [...events].reverse()

  let lastDay = ''
  for (const event of oldestFirst) {
    const day = event.timestamp.slice(0, 10)
    if (day !== lastDay) {
      if (lastDay) console.log()
      console.log(`   ${color(ANSI.bold, day)}`)
      console.log()
      lastDay = day
    }

    const time = formatTime(event.timestamp)
    console.log(
      `   ${color(ANSI.cyan, time)}  ${color(ANSI.cyan, '▸')} ${color(ANSI.bold, event.author)}`
    )
    for (const change of event.changes) {
      const icon = kindIcon[change.kind]
      console.log(`          ${color(ANSI.gray, '•')} ${icon} ${change.text}`)
    }
    console.log()
  }

  console.log(`  ${color(ANSI.dim, ruleLine)}`)
  console.log()

  const completions = collectCompletions(oldestFirst)
  if (completions.length > 0) {
    console.log(`  ${color(ANSI.bold, '✅ Task Completion Log')}`)
    console.log()
    printTable(
      ['Completed at', 'Task', 'By'],
      completions.map((c) => [c.time, c.text, c.author]),
      [12, 60, 16]
    )
    console.log()
  }

  const contributors = collectContributors(oldestFirst)
  console.log(`  ${color(ANSI.bold, '👥 Contributor Summary')}`)
  console.log()
  printTable(
    ['Contributor', 'Tasks completed', 'First activity', 'Last activity'],
    contributors.map((c) => [
      c.name,
      formatContributorScore(c),
      c.firstActivity,
      c.lastActivity,
    ]),
    [24, 24, 16, 16]
  )
  console.log()

  const oldest = oldestFirst[0]
  const newest = oldestFirst[oldestFirst.length - 1]
  const oldestDay = oldest.timestamp.slice(0, 10)
  const newestDay = newest.timestamp.slice(0, 10)
  const duration = formatDuration(oldest.timestamp, newest.timestamp)

  if (oldestDay === newestDay) {
    console.log(
      `  Total active window: ${color(ANSI.bold, formatTime(oldest.timestamp))} → ${color(ANSI.bold, formatTime(newest.timestamp))} (${duration}) on ${oldestDay}`
    )
  } else {
    console.log(
      `  Total active window: ${oldestDay} ${formatTime(oldest.timestamp)} → ${newestDay} ${formatTime(newest.timestamp)} (${duration})`
    )
  }
  console.log()
}

export { showActivity }
