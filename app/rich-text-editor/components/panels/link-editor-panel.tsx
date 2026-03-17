import { useCallback, useMemo, useState } from 'react'
import { Button } from '~/rich-text-editor/components/ui/button'
import { Icon } from '~/rich-text-editor/components/ui/icon'
import { Surface } from '~/rich-text-editor/components/ui/surface'
import { Toggle } from '~/rich-text-editor/components/ui/toggle'

type Props = {
  initialUrl?: string
  initialOpenInNewTab?: boolean
  onSetLink: (url: string, openInNewTab?: boolean) => void
}

const useLinkEditorState = ({
  initialUrl,
  initialOpenInNewTab,
  onSetLink,
}: Props) => {
  const [url, setUrl] = useState(initialUrl || '')
  const [openInNewTab, setOpenInNewTab] = useState(initialOpenInNewTab || false)

  const onChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(event.target.value)
  }, [])

  const isValidUrl = useMemo(() => /^(\S+):(\/\/)?\S+$/.test(url), [url])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (isValidUrl) {
        onSetLink(url, openInNewTab)
      }
    },
    [url, isValidUrl, openInNewTab, onSetLink]
  )

  return {
    url,
    setUrl,
    openInNewTab,
    setOpenInNewTab,
    onChange,
    handleSubmit,
    isValidUrl,
  }
}

const LinkEditorPanel = ({
  onSetLink,
  initialOpenInNewTab,
  initialUrl,
}: Props) => {
  const state = useLinkEditorState({
    onSetLink,
    initialOpenInNewTab,
    initialUrl,
  })

  return (
    <Surface className="p-2">
      <form onSubmit={state.handleSubmit} className="flex items-center gap-2">
        <label className="flex cursor-text items-center gap-2 rounded-lg bg-neutral-100 p-2 dark:bg-neutral-900">
          <Icon name="Link" className="flex-none text-black dark:text-white" />
          <input
            type="url"
            className="min-w-[12rem] flex-1 bg-transparent text-black text-sm outline-hidden dark:text-white"
            placeholder="Enter URL"
            value={state.url}
            onChange={state.onChange}
          />
        </label>
        <Button
          variant="primary"
          buttonSize="small"
          type="submit"
          disabled={!state.isValidUrl}
        >
          Set Link
        </Button>
      </form>
      <div className="mt-3">
        <label className="flex cursor-pointer select-none items-center justify-start gap-2 font-semibold text-neutral-500 text-sm dark:text-neutral-400">
          Open in new tab
          <Toggle
            active={state.openInNewTab}
            onChange={state.setOpenInNewTab}
          />
        </label>
      </div>
    </Surface>
  )
}

export { LinkEditorPanel }
