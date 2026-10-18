import type { ShortcutSettings } from '../../../shared/types'
import { SHORTCUT_LABELS } from '../../../shared/types'
import { prettyAccelerator } from '../keyboard'
import { useDialogKeys } from './useDialogKeys'

/** In-window shortcuts; the source of truth for the key map lives in App. */
export const IN_APP_SHORTCUTS: [string, string][] = [
  ['Enter', 'Send the prompt'],
  ['Shift+Enter', 'New line in the prompt'],
  ['Escape', 'Stop the answer, close a dialog, or hide the overlay'],
  ['CommandOrControl+L', 'Focus the prompt box'],
  ['Alt+1', '…Alt + 5: send a quick follow-up'],
  ['CommandOrControl+1', '…Ctrl + 3: switch DSA / LLD / System Design'],
  ['CommandOrControl+N', 'Start a new problem'],
  ['CommandOrControl+Shift+C', 'Copy the last code block'],
  ['PageUp', 'Scroll the answer (also PageDown, Alt + Up / Down)'],
  ['CommandOrControl+Shift+Backspace', 'Remove the newest context item'],
  ['CommandOrControl+Shift+X', 'Clear all context'],
  ['CommandOrControl+[', 'Less opaque background (Ctrl + ] for more)'],
  ['CommandOrControl+,', 'Settings'],
  ['CommandOrControl+/', 'This list']
]

export function ShortcutHelp({ shortcuts, onClose }: { shortcuts: ShortcutSettings; onClose(): void }) {
  const ref = useDialogKeys<HTMLDivElement>(onClose)
  const globals = (Object.keys(SHORTCUT_LABELS) as (keyof ShortcutSettings)[]).filter(
    (k) => k !== 'captureScreen' && k !== 'toggleRecording'
  )
  return (
    <div className="dialog__backdrop">
      <div className="dialog" role="dialog" aria-label="Keyboard shortcuts" ref={ref} tabIndex={-1}>
        <h2>Keyboard shortcuts</h2>
        <h3>Anywhere (even when another app is focused)</h3>
        <table className="keys">
          <tbody>
            {globals.map((k) => (
              <tr key={k}>
                <td>
                  <kbd>
                    {prettyAccelerator(shortcuts[k])}
                    {k === 'moveWindowModifier' && shortcuts[k] ? ' + ←↑→↓' : ''}
                  </kbd>
                </td>
                <td>{SHORTCUT_LABELS[k]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3>In the overlay</h3>
        <table className="keys">
          <tbody>
            {IN_APP_SHORTCUTS.map(([keys, label]) => (
              <tr key={keys}>
                <td>
                  <kbd>{prettyAccelerator(keys)}</kbd>
                </td>
                <td>{label}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">Global shortcuts can be changed in Settings. Press Esc to close.</p>
      </div>
    </div>
  )
}
