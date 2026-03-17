import { isTextSelection } from '@tiptap/core'
import type { Editor } from '@tiptap/react'
import { twMerge } from 'tailwind-merge'
import { cx } from '~/lib/utils'
import { CodeBlock, Link } from '~/rich-text-editor/extensions'

const isCustomNodeSelected = (editor: Editor) => {
  const customNodes = [CodeBlock.name, Link.name]

  return customNodes.some((type) => editor.isActive(type))
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
  return twMerge(cx(inputs))
}

export { cn, isCustomNodeSelected, isTextSelected }
