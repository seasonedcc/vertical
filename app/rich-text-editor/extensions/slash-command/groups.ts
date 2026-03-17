import type { Group } from './types'

const GROUPS: Group[] = [
  {
    name: 'format',
    title: 'Format',
    commands: [
      {
        name: 'heading1',
        label: 'Heading 1',
        iconName: 'Heading1',
        description: 'High priority section title',
        aliases: ['h1'],
        action: (editor) => {
          editor.chain().focus().setHeading({ level: 1 }).run()
        },
      },
      {
        name: 'heading2',
        label: 'Heading 2',
        iconName: 'Heading2',
        description: 'Medium priority section title',
        aliases: ['h2'],
        action: (editor) => {
          editor.chain().focus().setHeading({ level: 2 }).run()
        },
      },
      {
        name: 'heading3',
        label: 'Heading 3',
        iconName: 'Heading3',
        description: 'Low priority section title',
        aliases: ['h3'],
        action: (editor) => {
          editor.chain().focus().setHeading({ level: 3 }).run()
        },
      },
      {
        name: 'heading4',
        label: 'Heading 4',
        iconName: 'Heading4',
        description: 'Low priority section title',
        aliases: ['h4'],
        action: (editor) => {
          editor.chain().focus().setHeading({ level: 4 }).run()
        },
      },
      {
        name: 'heading5',
        label: 'Heading 5',
        iconName: 'Heading5',
        description: 'Low priority section title',
        aliases: ['h5'],
        action: (editor) => {
          editor.chain().focus().setHeading({ level: 5 }).run()
        },
      },
      {
        name: 'heading6',
        label: 'Heading 6',
        iconName: 'Heading6',
        description: 'Low priority section title',
        aliases: ['h6'],
        action: (editor) => {
          editor.chain().focus().setHeading({ level: 6 }).run()
        },
      },
      {
        name: 'bulletList',
        label: 'Bullet List',
        iconName: 'List',
        description: 'Unordered list of items',
        aliases: ['ul'],
        action: (editor) => {
          editor.chain().focus().toggleBulletList().run()
        },
      },
      {
        name: 'numberedList',
        label: 'Numbered List',
        iconName: 'ListOrdered',
        description: 'Ordered list of items',
        aliases: ['ol'],
        action: (editor) => {
          editor.chain().focus().toggleOrderedList().run()
        },
      },
      {
        name: 'blockquote',
        label: 'Blockquote',
        iconName: 'Quote',
        description: 'Element for quoting',
        action: (editor) => {
          editor.chain().focus().setBlockquote().run()
        },
      },
    ],
  },
  {
    name: 'insert',
    title: 'Insert',
    commands: [
      {
        name: 'horizontalRule',
        label: 'Horizontal Rule',
        iconName: 'Minus',
        description: 'Insert a horizontal divider',
        aliases: ['hr'],
        action: (editor) => {
          editor.chain().focus().setHorizontalRule().run()
        },
      },
    ],
  },
]

export { GROUPS }
