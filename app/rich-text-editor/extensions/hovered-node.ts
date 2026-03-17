import { Extension } from '@tiptap/core'
import type { ResolvedPos } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const HoveredNode = Extension.create({
  name: 'hoveredNode',

  addProseMirrorPlugins() {
    let hoverPos: number | null = null

    return [
      new Plugin({
        key: new PluginKey('hoveredNode'),
        props: {
          handleDOMEvents: {
            mousemove(view, event) {
              const coords = { left: event.clientX, top: event.clientY }
              const pos = view.posAtCoords(coords)
              if (!pos) {
                hoverPos = null
                view.dispatch(view.state.tr) // force re-render
                return false
              }

              const $pos = view.state.doc.resolve(pos.pos)
              const node = $pos.node($pos.depth)
              if (!node || !node.isBlock) {
                hoverPos = null
                view.dispatch(view.state.tr)
                return false
              }

              let newHoverPos: number
              if ($pos.depth > 0) {
                newHoverPos = $pos.before($pos.depth)
              } else {
                newHoverPos = $pos.pos
              }
              if (hoverPos !== newHoverPos) {
                hoverPos = newHoverPos
                view.dispatch(view.state.tr) // trigger decorations update
              }

              return false
            },
            mouseleave(view) {
              hoverPos = null
              view.dispatch(view.state.tr)
              return false
            },
          },
          decorations(state) {
            if (hoverPos === null) return null
            if (hoverPos < 0 || hoverPos > state.doc.content.size) return null

            let $hover: ResolvedPos
            try {
              $hover = state.doc.resolve(hoverPos)
            } catch {
              return null
            }
            const node = $hover.nodeAfter || $hover.nodeBefore
            if (!node || !node.isBlock) return null

            return DecorationSet.create(state.doc, [
              Decoration.node(hoverPos, hoverPos + node.nodeSize, {
                class: 'hovered-node',
              }),
            ])
          },
        },
      }),
    ]
  },
})

export { HoveredNode }
