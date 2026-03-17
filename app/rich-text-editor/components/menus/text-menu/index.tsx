import * as Popover from '@radix-ui/react-popover'
import { BubbleMenu, type Editor } from '@tiptap/react'
import { memo, useEffect, useState } from 'react'
import { Icon } from '~/rich-text-editor/components/ui/icon'
import { Toolbar } from '~/rich-text-editor/components/ui/toolbar'
import { ContentTypePicker } from './components/content-type-picker'
import { EditLinkPopover } from './components/edit-link-popover'
import { useTextmenuCommands } from './hooks/use-textmenu-commands'
import { useTextmenuContentTypes } from './hooks/use-textmenu-content-types'
import { useTextmenuStates } from './hooks/use-textmenu-states'

const MemoButton = memo(Toolbar.Button)
const MemoContentTypePicker = memo(ContentTypePicker)

const TextMenu = ({
  editor,
  appendTo,
}: {
  editor: Editor
  appendTo?: React.RefObject<any>
}) => {
  const [selecting, setSelecting] = useState(false)
  const commands = useTextmenuCommands(editor)
  const states = useTextmenuStates(editor)
  const blockOptions = useTextmenuContentTypes(editor)

  useEffect(() => {
    let selectionTimeout: number
    const onSelectionChange = () => {
      setSelecting(true)

      if (selectionTimeout) window.clearTimeout(selectionTimeout)
      selectionTimeout = window.setTimeout(() => setSelecting(false), 500)
    }

    editor.on('selectionUpdate', onSelectionChange)

    return () => {
      editor.off('selectionUpdate', onSelectionChange)
    }
  }, [])

  return (
    <BubbleMenu
      className={selecting ? 'invisible opacity-0' : ''}
      tippyOptions={{
        popperOptions: {
          placement: 'top-start',
          modifiers: [
            {
              name: 'preventOverflow',
              options: {
                padding: 64,
              },
            },
            {
              name: 'flip',
              options: {
                fallbackPlacements: ['bottom-start', 'top-end', 'bottom-end'],
              },
            },
          ],
        },
        appendTo: () => {
          return appendTo?.current
        },
        offset: [0, 8],
        maxWidth: 'calc(100vw - 16px)',
      }}
      editor={editor}
      pluginKey="textMenu"
      shouldShow={states.shouldShow}
      updateDelay={0}
    >
      <Toolbar.Wrapper isVertical>
        <div className="grid grid-cols-4 gap-y-1 sm:flex sm:gap-x-1">
          <MemoContentTypePicker options={blockOptions} />
          <MemoButton
            tooltip="Bold"
            tooltipShortcut={['Mod', 'B']}
            onClick={commands.onBold}
            active={states.isBold}
          >
            <Icon name="Bold" />
          </MemoButton>
          <MemoButton
            tooltip="Italic"
            tooltipShortcut={['Mod', 'I']}
            onClick={commands.onItalic}
            active={states.isItalic}
          >
            <Icon name="Italic" />
          </MemoButton>
          <MemoButton
            tooltip="Underline"
            tooltipShortcut={['Mod', 'U']}
            onClick={commands.onUnderline}
            active={states.isUnderline}
          >
            <Icon name="Underline" />
          </MemoButton>
          <MemoButton
            tooltip="Strikehrough"
            tooltipShortcut={['Mod', 'Shift', 'S']}
            onClick={commands.onStrike}
            active={states.isStrike}
          >
            <Icon name="Strikethrough" />
          </MemoButton>
          <MemoButton
            tooltip="Code"
            tooltipShortcut={['Mod', 'E']}
            onClick={commands.onCode}
            active={states.isCode}
          >
            <Icon name="Code" />
          </MemoButton>
          <EditLinkPopover onSetLink={commands.onLink} />
          <Popover.Root>
            <Popover.Trigger asChild>
              <MemoButton tooltip="More options">
                <Icon name="EllipsisVertical" />
              </MemoButton>
            </Popover.Trigger>
            <Popover.Content side="top" asChild>
              <Toolbar.Wrapper>
                <MemoButton
                  tooltip="Subscript"
                  tooltipShortcut={['Mod', '.']}
                  onClick={commands.onSubscript}
                  active={states.isSubscript}
                >
                  <Icon name="Subscript" />
                </MemoButton>
                <MemoButton
                  tooltip="Superscript"
                  tooltipShortcut={['Mod', ',']}
                  onClick={commands.onSuperscript}
                  active={states.isSuperscript}
                >
                  <Icon name="Superscript" />
                </MemoButton>
                <Toolbar.Divider />
                <MemoButton
                  tooltip="Align left"
                  tooltipShortcut={['Shift', 'Mod', 'L']}
                  onClick={commands.onAlignLeft}
                  active={states.isAlignLeft}
                >
                  <Icon name="AlignLeft" />
                </MemoButton>
                <MemoButton
                  tooltip="Align center"
                  tooltipShortcut={['Shift', 'Mod', 'E']}
                  onClick={commands.onAlignCenter}
                  active={states.isAlignCenter}
                >
                  <Icon name="AlignCenter" />
                </MemoButton>
                <MemoButton
                  tooltip="Align right"
                  tooltipShortcut={['Shift', 'Mod', 'R']}
                  onClick={commands.onAlignRight}
                  active={states.isAlignRight}
                >
                  <Icon name="AlignRight" />
                </MemoButton>
                <MemoButton
                  tooltip="Justify"
                  tooltipShortcut={['Shift', 'Mod', 'J']}
                  onClick={commands.onAlignJustify}
                  active={states.isAlignJustify}
                >
                  <Icon name="AlignJustify" />
                </MemoButton>
              </Toolbar.Wrapper>
            </Popover.Content>
          </Popover.Root>
        </div>
      </Toolbar.Wrapper>
    </BubbleMenu>
  )
}

export { TextMenu }
