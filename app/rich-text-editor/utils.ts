import { isTextSelection } from '@tiptap/core'
import type { Editor } from '@tiptap/react'
import { cx } from '~/lib/utils'
import { Link } from '~/rich-text-editor/extensions'

const isCustomNodeSelected = (editor: Editor) => {
  return editor.isActive(Link.name)
}

const isTextSelected = ({ editor }: { editor: Editor }) => {
  const {
    state: {
      doc,
      selection,
      selection: { empty, from, to },
    },
  } = editor

  const isEmptyTextBlock =
    !doc.textBetween(from, to).length && isTextSelection(selection)

  if (empty || isEmptyTextBlock) {
    return false
  }

  return true
}

function cn(...inputs: unknown[]) {
  return cx(inputs)
}

export { cn, isCustomNodeSelected, isTextSelected }
