import * as Popover from '@radix-ui/react-popover'
import { LinkEditorPanel } from '~/rich-text-editor/components/panels'
import { Icon } from '~/rich-text-editor/components/ui/icon'
import { Toolbar } from '~/rich-text-editor/components/ui/toolbar'

const EditLinkPopover = ({
  onSetLink,
}: {
  onSetLink: (link: string, openInNewTab?: boolean) => void
}) => {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Toolbar.Button tooltip="Set Link">
          <Icon name="Link" />
        </Toolbar.Button>
      </Popover.Trigger>
      <Popover.Content>
        <LinkEditorPanel onSetLink={onSetLink} />
      </Popover.Content>
    </Popover.Root>
  )
}

export { EditLinkPopover }
