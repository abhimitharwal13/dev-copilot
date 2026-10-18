import { useState, type ClipboardEvent, type DragEvent, type KeyboardEvent, type Ref } from 'react'
import { api } from '../api'
import { IS_MAC } from '../keyboard'

interface Props {
  isFollowUp: boolean
  busy: boolean
  onSubmit(prompt: string): void
  onCancel(): void
  textareaRef: Ref<HTMLTextAreaElement>
}

/** One-key refinements; each is bound to Alt + its number. */
export const FOLLOW_UPS = [
  'Optimise for space',
  'More edge cases',
  'Explain the trade-offs',
  'Write tests',
  'Another language'
]

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** Images and files pasted or dropped here go to the context buffer, text stays in the prompt. */
async function addFiles(files: FileList): Promise<void> {
  for (const file of Array.from(files)) {
    if (file.type.startsWith('image/')) await api.context.addImage(await readAsDataUrl(file), 'paste')
    else await api.context.addText(`// ${file.name}\n${await file.text()}`, 'file')
  }
}

const MOD = IS_MAC ? '⌘' : 'Ctrl'
const ALT = IS_MAC ? '⌥' : 'Alt'

export function Composer({ isFollowUp, busy, onSubmit, onCancel, textareaRef }: Props) {
  const [prompt, setPrompt] = useState('')
  const [dragging, setDragging] = useState(false)

  const submit = (text = prompt): void => {
    if (busy) return
    onSubmit(text)
    setPrompt('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    // Enter sends; Shift+Enter adds a newline. Ctrl/⌘+Enter also sends, for muscle memory.
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>): void => {
    if (e.clipboardData.files.length > 0) {
      e.preventDefault()
      void addFiles(e.clipboardData.files)
    }
  }

  const onDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length > 0) void addFiles(e.dataTransfer.files)
  }

  return (
    <div
      className={`composer${dragging ? ' composer--drag' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {isFollowUp && (
        <div className="composer__chips">
          {FOLLOW_UPS.map((label, i) => (
            <button key={label} type="button" className="chip" disabled={busy} onClick={() => submit(label)}>
              <kbd>
                {ALT} {i + 1}
              </kbd>{' '}
              {label}
            </button>
          ))}
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={prompt}
        autoFocus
        placeholder={
          isFollowUp
            ? 'Ask a follow-up to refine the answer…'
            : 'Type or paste the problem, or press Enter with an empty box to solve the captured context…'
        }
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        rows={isFollowUp ? 2 : 4}
      />
      <div className="composer__actions">
        <span className="hint">
          <kbd>Enter</kbd> send · <kbd>Shift + Enter</kbd> new line · <kbd>{MOD} + /</kbd> all shortcuts
        </span>
        {busy ? (
          <button type="button" className="secondary" onClick={onCancel}>
            Stop <kbd>Esc</kbd>
          </button>
        ) : (
          <button type="button" className="primary" onClick={() => submit()}>
            {isFollowUp ? 'Refine' : 'Analyze'}
          </button>
        )}
      </div>
    </div>
  )
}
