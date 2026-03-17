import type { EditorOptions } from '@tiptap/core'
import { useEditor } from '@tiptap/react'

import { ExtensionKit } from '~/rich-text-editor/extensions/extension-kit'

const useBlockEditor = ({
  initialContent = '',
  ...editorOptions
}: {
  initialContent?: string
} & Partial<Omit<EditorOptions, 'extensions'>>) => {
  const editor = useEditor(
    {
      ...editorOptions,
      immediatelyRender: true,
      shouldRerenderOnTransaction: false,
      autofocus: true,
      onCreate: (ctx) => {
        if (ctx.editor.isEmpty) {
          ctx.editor.commands.setContent(initialContent)
          ctx.editor.commands.focus('start', { scrollIntoView: true })
        }
      },
      extensions: ExtensionKit(),
      editorProps: {
        attributes: {
          autocomplete: 'off',
          autocorrect: 'off',
          autocapitalize: 'off',
          class: 'min-h-full prose',
        },
      },
    },
    []
  )

  return { editor }
}

export { useBlockEditor }
