import { EditorContent } from '@tiptap/react'
import { useRef } from 'react'
import { cx } from '~/lib/utils'
import { BlockMenu } from './block-menu'
import { LinkMenu, TextMenu } from './components/menus'
import { CharacterCount } from './components/ui/character-count'
import { useBlockEditor } from './hooks/use-block-editor'

type Props = {
  initialContent?: string
  onChange?: (html: string) => void
  className?: string
}

function RichTextEditor({ initialContent, onChange, className }: Props) {
  const menuContainerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const { editor } = useBlockEditor({
    initialContent,
    onUpdate: ({ editor }) => {
      const currentHtml = editor.getHTML()
      onChange?.(currentHtml.replace(/<p><\/p>$/, ''))
    },
  })

  if (!editor) return null

  return (
    <div className="relative flex flex-1 flex-col" ref={menuContainerRef}>
      <div
        className={cx(
          'group relative overflow-y-auto bg-base-200 px-8 py-6',
          className
        )}
        ref={wrapperRef}
        onFocus={() => {
          document.documentElement.dataset.editingRichText = 'true'
        }}
        onBlur={() => {
          delete document.documentElement.dataset.editingRichText
        }}
      >
        <EditorContent editor={editor} className="flex-1" />
        <BlockMenu editor={editor} wrapper={wrapperRef} />
      </div>
      <CharacterCount editor={editor} />
      <LinkMenu editor={editor} appendTo={menuContainerRef} />
      <TextMenu editor={editor} appendTo={menuContainerRef} />
    </div>
  )
}

export { RichTextEditor }
