import type { Editor } from '@tiptap/core'

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
  iconName: string
  action: (editor: Editor) => void
  shouldBeHidden?: (editor: Editor) => boolean
}

type MenuListProps = {
  editor: Editor
  items: Group[]
  command: (command: Command) => void
}

export type { Group, Command, MenuListProps }
