import type { ShortcutSettings } from '../../../shared/types'
import { SHORTCUT_LABELS } from '../../../shared/types'
import { prettyAccelerator } from '../keyboard'
import { useDialogKeys } from './useDialogKeys'

/** In-window shortcuts; the source of truth for the key map lives in App. */
export const IN_APP_SHORTCUTS: [string, string][] = [
  ['Enter', 'Send the prompt'],
  ['Shift+Enter', 'New line in the prompt'],
  ['Escape', 'Stop the answer, close a dialog, or hide the overlay'],
  ['Tab', 'Move between the prompt box and the answer (number keys work in the answer)'],
  ['CommandOrControl+M', 'Minimize the overlay (the show/hide shortcut above brings it back)'],
  ['1', '…9: jump to that numbered section of the answer (0: back to the question); not while typing in the prompt'],
  ['CommandOrControl+L', 'Focus the prompt box'],
  ['Alt+1', '…Alt + 5: send a quick follow-up'],
  ['CommandOrControl+1', '…Ctrl + 4: switch DSA / LLD / System Design / Database'],
  ['CommandOrControl+N', 'Start a new problem'],
  ['CommandOrControl+J', 'Jump to the next section (Ctrl + Shift + J: previous)'],
  ['CommandOrControl+D', 'Open the diagram in view full-size (+ / - zoom, Tab next, Ctrl + S save SVG)'],
  ['CommandOrControl+S', 'Save the conversation as Markdown'],
  ['CommandOrControl+I', 'Toggle interview step mode (one section at a time)'],
  ['Alt+N', 'Step mode: write the next section'],
  ['CommandOrControl+Shift+C', 'Copy the solution code (all blocks of the code section)'],
  ['PageUp', 'Scroll the answer (also PageDown, Alt + Up / Down)'],
  ['CommandOrControl+Shift+Backspace', 'Remove the newest context item'],
  ['CommandOrControl+Shift+X', 'Clear all context'],
  ['CommandOrControl+[', 'Less opaque background (Ctrl + ] for more)'],
  ['CommandOrControl+-', 'Smaller text (Ctrl + = bigger, Ctrl + 0 reset)'],
  ['CommandOrControl+,', 'Settings'],
  ['CommandOrControl+/', 'This list']
]

export function ShortcutHelp({ shortcuts, onClose }: { shortcuts: ShortcutSettings; onClose(): void }) {
  const ref = useDialogKeys<HTMLDivElement>(onClose)
  const globals = (Object.keys(SHORTCUT_LABELS) as (keyof ShortcutSettings)[]).filter(
    (k) => k !== 'toggleRecording'
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
