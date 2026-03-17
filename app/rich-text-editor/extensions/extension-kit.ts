import {
  CharacterCount,
  Color,
  Focus,
  Highlight,
  HoveredNode,
  Link,
  Placeholder,
  Selection,
  SlashCommand,
  StarterKit,
  Subscript,
  Superscript,
  TextAlign,
  TextStyle,
  TrailingNode,
  Typography,
  Underline,
} from '.'

const ExtensionKit = () => [
  Selection,
  HoveredNode,
  StarterKit.configure({ codeBlock: false }),
  CharacterCount,
  TextStyle,
  Color,
  TrailingNode,
  Link.configure({ openOnClick: false }),
  Highlight.configure({ multicolor: true }),
  Underline,
  TextAlign.extend({
    addKeyboardShortcuts() {
      return {}
    },
  }).configure({ types: ['heading', 'paragraph'] }),
  Subscript,
  Superscript,
  Typography,
  Placeholder.configure({
    includeChildren: true,
    showOnlyCurrent: false,
    placeholder: () => '',
  }),
  SlashCommand,
  Focus,
]

export { ExtensionKit }
