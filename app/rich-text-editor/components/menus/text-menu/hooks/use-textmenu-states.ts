import { type Editor, useEditorState } from '@tiptap/react'
import { useCallback } from 'react'
import { isCustomNodeSelected, isTextSelected } from '~/rich-text-editor/utils'
import type { ShouldShowProps } from '../../types'

const useTextmenuStates = (editor: Editor) => {
  const states = useEditorState({
    editor,
    selector: (ctx) => {
      return {
        isBold: ctx.editor.isActive('bold'),
        isItalic: ctx.editor.isActive('italic'),
        isStrike: ctx.editor.isActive('strike'),
        isUnderline: ctx.editor.isActive('underline'),
        isCode: ctx.editor.isActive('code'),
        isSubscript: ctx.editor.isActive('subscript'),
        isSuperscript: ctx.editor.isActive('superscript'),
        isAlignLeft: ctx.editor.isActive({ textAlign: 'left' }),
        isAlignCenter: ctx.editor.isActive({ textAlign: 'center' }),
        isAlignRight: ctx.editor.isActive({ textAlign: 'right' }),
        isAlignJustify: ctx.editor.isActive({ textAlign: 'justify' }),
      }
    },
  })

  const shouldShow = useCallback(
    ({ view }: ShouldShowProps) => {
      if (!view || editor.view.dragging) {
        return false
      }

      if (isCustomNodeSelected(editor)) {
        return false
      }

      return isTextSelected({ editor })
    },
    [editor]
  )

  return {
    shouldShow,
    ...states,
  }
}

export { useTextmenuStates }
