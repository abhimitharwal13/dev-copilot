import type { ContextItem } from '../../../shared/types'
import { api } from '../api'
import { prettyAccelerator } from '../keyboard'

const SOURCE_LABEL: Record<ContextItem['source'], string> = {
  typed: 'Note',
  clipboard: 'Clipboard',
  paste: 'Pasted',
  file: 'File',
  screen: 'Screen',
  audio: 'Voice'
}

interface Props {
  items: ContextItem[]
  clipboardShortcut: string
  screenShortcut: string
}

/** The context buffer: everything attached to the first question, and anything added since to the next follow-up. */
export function ContextPanel({ items, clipboardShortcut, screenShortcut }: Props) {
  return (
    <aside className="context">
      <header className="context__header">
        <h2>Context</h2>
        {items.length > 0 && (
          <button type="button" className="link" onClick={() => void api.context.clear()}>
            Clear <kbd>{prettyAccelerator('CommandOrControl+Shift+X')}</kbd>
          </button>
        )}
      </header>
      {items.length === 0 ? (
        <p className="context__empty">
          Press <kbd>{prettyAccelerator(screenShortcut)}</kbd> in any app to screenshot the screen, or{' '}
          <kbd>{prettyAccelerator(clipboardShortcut)}</kbd> to capture the clipboard. You can also paste into the prompt.
        </p>
      ) : (
        <ul className="context__list">
          {items.map((item) => (
            <li key={item.id} className="context__item">
              <div className="context__meta">
                <span className="tag">{SOURCE_LABEL[item.source]}</span>
                <button
                  type="button"
                  className="icon"
                  aria-label="Remove from context"
                  onClick={() => void api.context.remove(item.id)}
                >
                  ×
                </button>
              </div>
              {item.kind === 'image' ? (
                <img src={`data:${item.mediaType};base64,${item.data}`} alt="Captured context" />
              ) : (
                <pre>{item.text.length > 600 ? `${item.text.slice(0, 600)}…` : item.text}</pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
