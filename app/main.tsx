import { createRoot } from 'react-dom/client'
import './tailwind.css'
import './styles/rich-editor.css'
import './styles/code.css'
import { App } from '~/components/app'

// biome-ignore lint/style/noNonNullAssertion: root element always exists
createRoot(document.getElementById('root')!).render(<App />)
