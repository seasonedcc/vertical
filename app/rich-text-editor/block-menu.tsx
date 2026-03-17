import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import type { Node } from '@tiptap/pm/model'
import type { Editor } from '@tiptap/react'
import {
  ClipboardIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  RemoveFormattingIcon,
  Trash2Icon,
} from 'lucide-react'
import { useEffect, useState } from 'react'

const NODE_TYPES_WITHOUT_FORMATTING = ['horizontalRule']
const NODE_TYPES_WITHOUT_CONTENT_TO_COPY = ['horizontalRule']

type Props = { wrapper: React.RefObject<HTMLElement | null>; editor: Editor }

function BlockMenu({ wrapper, editor }: Props) {
  const [currentEl, setCurrentEl] = useState<HTMLElement>()
  const [top, setTop] = useState<number>()

  const calculateNodePos = () => {
    try {
      if (!currentEl) return { from: 0, to: 0, node: null }

      const { view, state } = editor
      const pos = view.posAtDOM(currentEl, 0)
      const $pos = state.doc.resolve(pos)

      let blockDepth = $pos.depth
      while (blockDepth > 0 && !$pos.node(blockDepth).type.isBlock) {
        blockDepth--
      }

      let from: number
      let to: number
      let shallowNode: Node
      if (blockDepth > 0) {
        shallowNode = $pos.node(blockDepth)
        from = $pos.start(blockDepth)
        to = $pos.end(blockDepth)
      } else {
        const childIndex = $pos.index()
        shallowNode = state.doc.child(childIndex)
        let posAcc = 0
        for (let i = 0; i < childIndex; i++) {
          posAcc += state.doc.child(i).nodeSize
        }
        from = posAcc
        to = from + shallowNode.nodeSize
      }
      return { from, to, node: shallowNode }
    } catch (_error) {
      return { from: 0, to: 0, node: null }
    }
  }

  const deleteNode = () => {
    if (!currentEl) return
    setTop(undefined)

    const { node, from, to } = calculateNodePos()
    if (!node) return
    editor.chain().deleteRange({ from, to }).focus().run()
  }

  const clearFormatting = () => {
    if (!currentEl) return
    setTop(undefined)

    const { view } = editor
    const { from, to } = calculateNodePos()

    editor
      .chain()
      .focus()
      .setNodeSelection(from)
      .setParagraph()
      .clearNodes()
      .run()

    editor.commands.command(({ tr }) => {
      tr.removeMark(from, to)
      view.dispatch(tr)
      return true
    })
  }

  const duplicateNode = () => {
    if (!currentEl) return
    setTop(undefined)

    const { to, node } = calculateNodePos()
    if (!node) return

    editor.commands.insertContentAt(to, node.copy(node.content))
  }

  const copyNodeToClipboard = async () => {
    if (!currentEl) return

    const { from } = calculateNodePos()
    editor.chain().setNodeSelection(from).run()

    document.execCommand('copy')
  }

  function updateMenuPosition() {
    const targetNode = document.querySelector(
      '.ProseMirror .hovered-node'
    ) as HTMLElement | null

    if (!targetNode || !wrapper.current) return

    const wrapperRect = wrapper.current.getBoundingClientRect()
    const hoveredRect = targetNode.getBoundingClientRect()
    setCurrentEl(targetNode)
    setTop(hoveredRect.top - wrapperRect.top + wrapper.current.scrollTop)
  }

  useEffect(() => {
    editor.on('transaction', updateMenuPosition)
    return () => {
      editor.off('transaction', updateMenuPosition)
    }
  }, [editor])

  useEffect(() => {
    if (!wrapper.current) return

    wrapper.current.addEventListener('mousemove', updateMenuPosition)
    return () => {
      wrapper.current?.removeEventListener('mousemove', updateMenuPosition)
    }
  }, [wrapper.current])

  if (top === undefined) return null

  const currentNode = calculateNodePos().node
  const hasClearFormat =
    currentNode &&
    !NODE_TYPES_WITHOUT_FORMATTING.includes(currentNode.type.name)
  const hasCopyToClipboard =
    currentNode &&
    !NODE_TYPES_WITHOUT_CONTENT_TO_COPY.includes(currentNode.type.name)

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          style={{ top }}
          className="btn btn-sm btn-square -translate-y-0.5 absolute top-0 left-2 h-6 w-6 opacity-0 group-hover:opacity-100"
          title="Block options"
        >
          <EllipsisVerticalIcon className="size-6" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          sideOffset={5}
          className="z-40 mr-2 flex flex-col gap-2 rounded bg-base-300 p-4"
        >
          {hasClearFormat && (
            <DropdownMenu.Item asChild>
              <button
                className="btn btn-sm btn-ghost justify-start"
                onClick={clearFormatting}
              >
                <RemoveFormattingIcon className="size-4" />
                Clear formatting
              </button>
            </DropdownMenu.Item>
          )}
          {hasCopyToClipboard && (
            <DropdownMenu.Item asChild>
              <button
                className="btn btn-sm btn-ghost justify-start"
                onClick={copyNodeToClipboard}
              >
                <ClipboardIcon className="size-4" />
                Copy to clipboard
              </button>
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item asChild>
            <button
              className="btn btn-sm btn-ghost justify-start"
              onClick={duplicateNode}
            >
              <CopyIcon className="size-4" />
              Duplicate
            </button>
          </DropdownMenu.Item>
          <hr className="border-neutral" />
          <DropdownMenu.Item asChild>
            <button
              className="btn btn-sm btn-ghost justify-start text-red-500"
              onClick={deleteNode}
            >
              <Trash2Icon className="size-4" />
              Delete
            </button>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export { BlockMenu }
