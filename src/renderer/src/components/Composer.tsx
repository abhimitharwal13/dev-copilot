import { useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react'
import { api } from '../api'

interface Props {
  isFollowUp: boolean
  busy: boolean
  onSubmit(prompt: string): void
  onCancel(): void
}

const FOLLOW_UPS = ['Optimise for space', 'More edge cases', 'Explain the trade-offs', 'Write tests', 'Another language']

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

export function Composer({ isFollowUp, busy, onSubmit, onCancel }: Props) {
  const [prompt, setPrompt] = useState('')
  const [dragging, setDragging] = useState(false)

  const submit = (text = prompt): void => {
    if (busy) return
    onSubmit(text)
    setPrompt('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
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
          {FOLLOW_UPS.map((label) => (
            <button key={label} type="button" className="chip" disabled={busy} onClick={() => submit(label)}>
              {label}
            </button>
          ))}
        </div>
      )}
      <textarea
        value={prompt}
        placeholder={
          isFollowUp
            ? 'Ask a follow-up to refine the answer…'
            : 'Describe the problem, paste it, or leave empty to solve the attached context…'
        }
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        rows={isFollowUp ? 2 : 5}
      />
      <div className="composer__actions">
        <span className="hint">Ctrl/⌘ + Enter to send · paste or drop images and files</span>
        {busy ? (
          <button type="button" className="secondary" onClick={onCancel}>
            Stop
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
