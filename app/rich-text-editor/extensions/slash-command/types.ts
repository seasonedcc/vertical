import type { Editor } from '@tiptap/core'

import type { icons } from 'lucide-react'

type Group = {
  name: string
  title: string
  commands: Command[]
}

type Command = {
  name: string
  label: string
  description: string
  aliases?: string[]
  iconName: keyof typeof icons
  action: (editor: Editor) => void
  shouldBeHidden?: (editor: Editor) => boolean
}

type MenuListProps = {
  editor: Editor
  items: Group[]
  command: (command: Command) => void
}

export type { Group, Command, MenuListProps }
