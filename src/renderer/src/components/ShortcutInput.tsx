import type { KeyboardEvent } from 'react'
import { eventAccelerator, eventModifiers, prettyAccelerator } from '../keyboard'

interface Props {
  id: string
  value: string
  onChange(accelerator: string): void
  /** Record only the modifiers (used for "modifier + arrow keys" bindings). */
  modifiersOnly?: boolean
}

/**
 * Focus it and press the new combination. Backspace or Delete alone turns the
 * shortcut off; Tab, Escape and Ctrl/⌘ + Enter keep their usual meaning so the
 * form stays navigable and savable.
 */
export function ShortcutInput({ id, value, onChange, modifiersOnly }: Props) {
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    const plain = !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey
    if (plain && (e.key === 'Tab' || e.key === 'Escape')) return
    // Ctrl/⌘ + Enter saves the dialog, so it can't be recorded.
    if (eventAccelerator(e) === 'CommandOrControl+Enter') return
    e.preventDefault()
    e.stopPropagation()
    if (plain && (e.key === 'Backspace' || e.key === 'Delete')) {
      onChange('')
      return
    }
    const accelerator = eventAccelerator(e)
    if (!accelerator) return
    const mods = eventModifiers(e)
    // A global shortcut without a modifier would swallow that key in every app.
    if (mods.length === 0 || (mods.length === 1 && mods[0] === 'Shift')) return
    onChange(modifiersOnly ? mods.join('+') : accelerator)
  }

  return (
    <input
      id={id}
      className="shortcut-input"
      readOnly
      value={prettyAccelerator(value)}
      title="Press the new key combination; Backspace turns it off"
      onKeyDown={onKeyDown}
    />
  )
}
