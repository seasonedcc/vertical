import { sortBy } from '~/lib/utils'
import type { BoardState, Layer, Slice } from '~/state/types'

const MIN_COL_WIDTH = 25
const MAX_COL_WIDTH = 40
const PADDING = 2

const ansi = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
}

function style(text: string, ...codes: string[]) {
  return `${codes.join('')}${text}${ansi.reset}`
}

const ANSI_PATTERN = new RegExp(`${'\x1b'}\\[[0-9;]*m`, 'g')

function stripAnsi(text: string) {
  return text.replace(ANSI_PATTERN, '')
}

function visibleLength(text: string) {
  return stripAnsi(text).length
}

function truncateStyled(text: string, maxWidth: number) {
  if (visibleLength(text) <= maxWidth) return text
  let visible = 0
  let i = 0
  while (i < text.length && visible < maxWidth - 1) {
    if (text[i] === '\x1b') {
      const end = text.indexOf('m', i)
      i = end + 1
      continue
    }
    visible++
    i++
  }
  return `${text.slice(0, i)}${ansi.reset}…`
}

function padRightStyled(text: string, width: number) {
  const padding = Math.max(0, width - visibleLength(text))
  return text + ' '.repeat(padding)
}

function getSliceLayers(state: BoardState, slice: Slice) {
  return sortBy(
    state.layers.filter((l) => l.sliceId === slice.id),
    'sorting'
  )
}

function getLayerTasks(state: BoardState, layer: Layer) {
  return sortBy(
    state.tasks.filter((t) => t.layerId === layer.id),
    'sorting'
  )
}

function getSliceTasks(state: BoardState, slice: Slice) {
  const layers = getSliceLayers(state, slice)
  return layers.flatMap((l) => getLayerTasks(state, l))
}

function buildCellLines(
  state: BoardState,
  slice: Slice,
  innerWidth: number
): string[] {
  const lines: string[] = []
  const layers = getSliceLayers(state, slice)
  const allTasks = getSliceTasks(state, slice)
  const hasMultipleLayers = layers.length > 1
  const separator = style('┄'.repeat(innerWidth), ansi.dim)

  if (slice.name) {
    lines.push(style(slice.name, ansi.bold, ansi.cyan))
  }

  if (allTasks.length === 0) {
    lines.push(style('(no tasks)', ansi.dim))
    return lines
  }

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i]
    const tasks = getLayerTasks(state, layer)

    if (hasMultipleLayers && i > 0) {
      lines.push(separator)
    }

    if (hasMultipleLayers) {
      const layerName = layer.name ?? `Layer ${i + 1}`
      if (layer.status === 'done') {
        lines.push(style(`✓ ${layerName} (done)`, ansi.green))
      } else {
        lines.push(style(layerName, ansi.bold))
      }
    }

    for (const task of tasks) {
      if (task.done) {
        lines.push(`  ${style('●', ansi.green)} ${style(task.name, ansi.dim)}`)
      } else {
        lines.push(`  ${style('○', ansi.yellow)} ${task.name}`)
      }
    }
  }

  return lines
}

function showBoardGrid(state: BoardState, boxId?: string) {
  const sortedSlices = sortBy(state.slices, 'boxNumber')
  const filteredSlices = boxId
    ? sortedSlices.filter((s) => s.id === boxId)
    : sortedSlices

  const colWidth = Math.min(
    MAX_COL_WIDTH,
    Math.max(
      MIN_COL_WIDTH,
      ...filteredSlices
        .flatMap((slice) => {
          const layers = getSliceLayers(state, slice)
          const tasks = getSliceTasks(state, slice)
          const widths = [
            slice.name?.length ?? 0,
            ...layers.map((l) => (l.name?.length ?? 0) + 10),
            ...tasks.map((t) => t.name.length + 4),
          ]
          return widths
        })
        .map((w) => w + PADDING * 2)
    )
  )
  const innerWidth = colWidth - PADDING * 2
  const numCols = boxId ? 1 : 3

  const cellContents = new Map<string, string[]>()
  for (const slice of filteredSlices) {
    cellContents.set(slice.id, buildCellLines(state, slice, innerWidth))
  }

  const rows: Slice[][] = []
  if (boxId) {
    rows.push(filteredSlices)
  } else {
    rows.push(
      filteredSlices.filter((s) => s.boxNumber >= 1 && s.boxNumber <= 3)
    )
    rows.push(
      filteredSlices.filter((s) => s.boxNumber >= 4 && s.boxNumber <= 6)
    )
    rows.push(
      filteredSlices.filter((s) => s.boxNumber >= 7 && s.boxNumber <= 9)
    )
  }

  console.log(style(state.project.name, ansi.bold))
  console.log()

  const border = (text: string) => style(text, ansi.dim)

  const makeBorder = (left: string, mid: string, right: string) => {
    const parts = []
    for (let c = 0; c < numCols; c++) {
      parts.push('─'.repeat(colWidth))
    }
    return border(left + parts.join(mid) + right)
  }

  const top = makeBorder('┌', '┬', '┐')
  const mid = makeBorder('├', '┼', '┤')
  const bot = makeBorder('└', '┴', '┘')

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    console.log(r === 0 ? top : mid)

    const cellLines = row.map((slice) => cellContents.get(slice.id) ?? [])
    const rowHeight = Math.max(3, ...cellLines.map((l) => l.length + 2))

    for (let line = 0; line < rowHeight; line++) {
      let output = border('│')
      for (let c = 0; c < numCols; c++) {
        const lines = cellLines[c] ?? []
        const contentLine = line - 1
        let content = ''
        if (contentLine >= 0 && contentLine < lines.length) {
          content = truncateStyled(lines[contentLine], innerWidth)
        }
        output += `${
          ' '.repeat(PADDING) +
          padRightStyled(content, innerWidth) +
          ' '.repeat(PADDING)
        }${border('│')}`
      }
      console.log(output)
    }
  }

  console.log(bot)

  const totalTasks = state.tasks.length
  const doneTasks = state.tasks.filter((t) => t.done).length
  const progressColor = doneTasks === totalTasks ? ansi.green : ansi.yellow
  console.log()
  console.log(
    `${style('Progress:', ansi.bold)} ${style(`${doneTasks}/${totalTasks}`, ansi.bold, progressColor)} tasks done`
  )
}

function formatGroupLabel(boxNumbers: number[]) {
  if (boxNumbers.length === 0) return ''
  if (boxNumbers.length === 1) return `Box ${boxNumbers[0]}`

  const ranges: string[] = []
  let start = boxNumbers[0]
  let end = boxNumbers[0]

  for (let i = 1; i < boxNumbers.length; i++) {
    if (boxNumbers[i] === end + 1) {
      end = boxNumbers[i]
    } else {
      ranges.push(start === end ? `${start}` : `${start}–${end}`)
      start = boxNumbers[i]
      end = boxNumbers[i]
    }
  }
  ranges.push(start === end ? `${start}` : `${start}–${end}`)

  return `Boxes ${ranges.join(', ')}`
}

function buildStatusText(state: BoardState, slice: Slice) {
  const layers = getSliceLayers(state, slice)
  const tasks = getSliceTasks(state, slice)

  if (tasks.length === 0) return style('No tasks yet', ansi.dim)

  const doneTasks = tasks.filter((t) => t.done).length
  const totalTasks = tasks.length

  if (doneTasks === totalTasks) return style('All done', ansi.green)

  if (layers.length > 1) {
    const doneLayerNames = layers
      .filter((l) => l.status === 'done')
      .map((l) => {
        const idx = layers.indexOf(l)
        return l.name ?? `Layer ${idx + 1}`
      })

    const openCount = totalTasks - doneTasks
    const parts: string[] = []

    if (doneLayerNames.length > 0) {
      parts.push(`${doneLayerNames.join(', ')} marked done`)
    }
    if (openCount > 0) {
      parts.push(`${openCount} task${openCount === 1 ? '' : 's'} still open`)
    }

    return parts.join(', ')
  }

  return `${doneTasks}/${totalTasks} tasks done`
}

type SummaryRow = {
  scope: string
  done: string
  status: string
}

function showSummaryTable(state: BoardState, boxId?: string) {
  const sortedSlices = sortBy(state.slices, 'boxNumber')
  const filteredSlices = boxId
    ? sortedSlices.filter((s) => s.id === boxId)
    : sortedSlices

  const summaryRows: SummaryRow[] = []
  const unnamedEmpty: number[] = []

  for (const slice of filteredSlices) {
    const tasks = getSliceTasks(state, slice)

    if (!slice.name && tasks.length === 0) {
      unnamedEmpty.push(slice.boxNumber)
      continue
    }

    const doneTasks = tasks.filter((t) => t.done).length
    const doneColor =
      tasks.length > 0 && doneTasks === tasks.length ? ansi.green : ansi.yellow
    summaryRows.push({
      scope: style(slice.name ?? `Box ${slice.boxNumber}`, ansi.bold),
      done:
        tasks.length > 0
          ? style(`${doneTasks}/${tasks.length}`, doneColor)
          : style('—', ansi.dim),
      status: buildStatusText(state, slice),
    })
  }

  if (unnamedEmpty.length > 0) {
    summaryRows.push({
      scope: style(formatGroupLabel(unnamedEmpty), ansi.dim),
      done: style('—', ansi.dim),
      status: style('Unnamed & empty', ansi.dim),
    })
  }

  if (summaryRows.length === 0) return

  const headers = {
    scope: style('Scope', ansi.bold),
    done: style('Done', ansi.bold),
    status: style('Status', ansi.bold),
  }
  const scopeWidth = Math.max(
    visibleLength(headers.scope),
    ...summaryRows.map((r) => visibleLength(r.scope))
  )
  const doneWidth = Math.max(
    visibleLength(headers.done),
    ...summaryRows.map((r) => visibleLength(r.done))
  )
  const statusWidth = Math.max(
    visibleLength(headers.status),
    ...summaryRows.map((r) => visibleLength(r.status))
  )

  const pad = (text: string, width: number) =>
    ` ${padRightStyled(text, width)} `

  const centerPad = (text: string, width: number) => {
    const totalPad = width - visibleLength(text)
    const left = Math.floor(totalPad / 2)
    const right = totalPad - left
    return ` ${' '.repeat(left)}${text}${' '.repeat(right)} `
  }

  const border = (text: string) => style(text, ansi.dim)

  const hLine = (left: string, mid: string, right: string) =>
    border(
      `${left}${'─'.repeat(scopeWidth + 2)}${mid}${'─'.repeat(doneWidth + 2)}${mid}${'─'.repeat(statusWidth + 2)}${right}`
    )

  console.log()
  console.log(hLine('┌', '┬', '┐'))
  console.log(
    `${border('│')}${centerPad(headers.scope, scopeWidth)}${border('│')}${centerPad(headers.done, doneWidth)}${border('│')}${centerPad(headers.status, statusWidth)}${border('│')}`
  )
  console.log(hLine('├', '┼', '┤'))

  for (let i = 0; i < summaryRows.length; i++) {
    const row = summaryRows[i]
    console.log(
      `${border('│')}${pad(row.scope, scopeWidth)}${border('│')}${pad(row.done, doneWidth)}${border('│')}${pad(row.status, statusWidth)}${border('│')}`
    )
    if (i < summaryRows.length - 1) {
      console.log(hLine('├', '┼', '┤'))
    }
  }

  console.log(hLine('└', '┴', '┘'))
}

export { showBoardGrid, showSummaryTable }
