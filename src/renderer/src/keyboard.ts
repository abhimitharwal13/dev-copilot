import { useEffect, useRef } from 'react'

export const IS_MAC = navigator.userAgent.includes('Mac')

const CODE_TO_KEY: Record<string, string> = {
  Space: 'Space',
  Escape: 'Escape',
  Enter: 'Enter',
  NumpadEnter: 'Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/'
}

const MODIFIER_CODES = /^(Shift|Control|Alt|Meta|OS)(Left|Right)?$/

/** The non-modifier key of an event, in Electron accelerator spelling, or null for a bare modifier. */
export function eventKey(e: KeyboardEvent | React.KeyboardEvent): string | null {
  const code = e.code
  if (MODIFIER_CODES.test(code)) return null
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^(Digit|Numpad)[0-9]$/.test(code)) return code.slice(-1)
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code
  return CODE_TO_KEY[code] ?? null
}

/** Modifier part of an Electron accelerator, e.g. `CommandOrControl+Shift`. */
export function eventModifiers(e: KeyboardEvent | React.KeyboardEvent): string[] {
  const mods: string[] = []
  if (IS_MAC ? e.metaKey : e.ctrlKey) mods.push('CommandOrControl')
  if (IS_MAC && e.ctrlKey) mods.push('Control')
  if (!IS_MAC && e.metaKey) mods.push('Super')
  if (e.altKey) mods.push('Alt')
  if (e.shiftKey) mods.push('Shift')
  return mods
}

/** Full accelerator for an event, or null while only modifiers are held. */
export function eventAccelerator(e: KeyboardEvent | React.KeyboardEvent): string | null {
  const key = eventKey(e)
  return key ? [...eventModifiers(e), key].join('+') : null
}

/** Readable label: `CommandOrControl+Shift+K` → `Ctrl + Shift + K` (⌘ on macOS). */
export function prettyAccelerator(accelerator: string): string {
  if (!accelerator) return 'Off'
  return accelerator
    .replace('CommandOrControl', IS_MAC ? '⌘' : 'Ctrl')
    .replace('Control', IS_MAC ? '⌃' : 'Ctrl')
    .replace('Alt', IS_MAC ? '⌥' : 'Alt')
    .split('+')
    .join(' + ')
}

export type KeyMap = Record<string, (e: KeyboardEvent) => void>

/**
 * In-window shortcuts. Keys are accelerators as produced by `eventAccelerator`.
 * The latest map is always used, so handlers may close over fresh state.
 */
export function useKeyMap(map: KeyMap): void {
  const ref = useRef(map)
  ref.current = map
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const accelerator = eventAccelerator(e)
      const handler = accelerator ? ref.current[accelerator] : undefined
      if (!handler) return
      e.preventDefault()
      e.stopPropagation()
      handler(e)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])
}
