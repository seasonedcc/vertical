import { useRef } from 'react'

function cx(...args: unknown[]): string {
  return args
    .flat()
    .filter((x) => typeof x === 'string')
    .join(' ')
}

function usePlaceCursorOnClickedPosition() {
  const clickPositionRef = useRef<number | null>(null)
  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    const isClickFromMouse = event.detail > 0

    if (!isClickFromMouse) {
      clickPositionRef.current = event.currentTarget.textContent?.length || 0
      return
    }

    const range = document.caretPositionFromPoint
      ? document.caretPositionFromPoint(event.clientX, event.clientY)
      : null
    const deprecatedRange = document.caretRangeFromPoint
      ? document.caretRangeFromPoint(event.clientX, event.clientY)
      : null

    if (range || deprecatedRange) {
      const preCaretRange = document.createRange()
      preCaretRange.selectNodeContents(event.currentTarget)
      const container = range
        ? range.offsetNode
        : deprecatedRange?.startContainer
      const offset = range ? range.offset : deprecatedRange?.startOffset
      if (container != null && offset != null) {
        preCaretRange.setEnd(container, offset)
      }
      clickPositionRef.current = preCaretRange.toString().length
    }
  }

  function handleFocus(
    event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    if (clickPositionRef.current !== null) {
      event.target.setSelectionRange(
        clickPositionRef.current,
        clickPositionRef.current
      )
      clickPositionRef.current = null
    }
  }
  return { handleClick, handleFocus }
}

function sortBy<T extends Record<string, unknown>>(
  array: T[],
  keys: string | string[]
): T[] {
  const fields = Array.isArray(keys) ? keys : [keys]
  return [...array].sort((a, b) => {
    for (const key of fields) {
      const aVal = a[key] as string | number
      const bVal = b[key] as string | number
      if (aVal < bVal) return -1
      if (aVal > bVal) return 1
    }
    return 0
  })
}

export { cx, sortBy, usePlaceCursorOnClickedPosition }
