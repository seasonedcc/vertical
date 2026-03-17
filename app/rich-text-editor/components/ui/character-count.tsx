import '@tiptap/core'
import type { Editor } from '@tiptap/core'
import { useEffect, useState } from 'react'

function CharacterCount({ editor }: { editor: Editor }) {
  const [count, setCount] = useState({ characters: 0, words: 0 })
  const storage = editor.storage as {
    characterCount: { characters: () => number; words: () => number }
  }
  useEffect(() => {
    const updateCount = () => {
      setCount({
        characters: storage.characterCount.characters(),
        words: storage.characterCount.words(),
      })
    }

    editor.on('transaction', updateCount)
    return () => {
      editor.off('transaction', updateCount)
    }
  }, [editor])

  if (!editor || count.characters === 0) return <div />

  return (
    <div className="mx-1 mt-2 flex justify-end gap-1 text-sm">
      <span>Characters: {count.characters}</span>
      {'/'}
      <span>Words: {count.words}</span>
    </div>
  )
}

export { CharacterCount }
