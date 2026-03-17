import { Icon } from '~/rich-text-editor/components/ui/icon'
import { Surface } from '~/rich-text-editor/components/ui/surface'
import { Toolbar } from '~/rich-text-editor/components/ui/toolbar'
import { Tooltip } from '~/rich-text-editor/components/ui/tooltip'

const LinkPreviewPanel = ({
  onClear,
  onEdit,
  url,
}: {
  url: string
  onEdit: () => void
  onClear: () => void
}) => {
  const sanitizedLink = url?.startsWith('javascript:') ? '' : url
  return (
    <Surface className="flex items-center gap-2 p-2">
      <a
        href={sanitizedLink}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-sm underline"
      >
        {url}
      </a>
      <Toolbar.Divider />
      <Tooltip title="Edit link">
        <Toolbar.Button onClick={onEdit}>
          <Icon name="Pen" />
        </Toolbar.Button>
      </Tooltip>
      <Tooltip title="Remove link">
        <Toolbar.Button onClick={onClear}>
          <Icon name="Trash2" />
        </Toolbar.Button>
      </Tooltip>
    </Surface>
  )
}

export { LinkPreviewPanel }
