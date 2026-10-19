import { clipboard, globalShortcut, type BrowserWindow } from 'electron'
import type { ShortcutSettings, UiCommand } from '../../shared/types'
import { nudgeWindow, showAndFocus } from '../window'
import type { ContextBuffer } from './ContextBuffer'
import type { ScreenCaptureService } from './InputSource'

export interface ShortcutDeps {
  buffer: ContextBuffer
  getWindow(): BrowserWindow | null
  /** Delivers a command to the renderer. */
  sendCommand(command: UiCommand): void
  /** When absent (e.g. in tests), the screen capture shortcut is skipped. */
  screenCapture?: ScreenCaptureService
  /** Absent until the Whisper iteration lands; its shortcut is then skipped. */
  toggleRecording?: () => void
}

/** Adds whatever is on the clipboard (image first, then text) to the buffer. */
export async function captureClipboard(buffer: ContextBuffer): Promise<boolean> {
  for (const item of await clipboard.read()) {
    if (item.types.includes('image/png')) {
      const blob = await item.getType('image/png')
      buffer.addImage(Buffer.from(await blob.arrayBuffer()).toString('base64'), 'image/png', 'clipboard')
      return true
    }
  }
  const text = await clipboard.readText()
  if (text.trim()) {
    buffer.addText(text, 'clipboard')
    return true
  }
  return false
}

/**
 * Screenshots the whole screen (or a picked region) into the buffer, then
 * brings the overlay forward with the prompt focused so Enter solves it.
 */
export async function captureScreen(
  service: ScreenCaptureService,
  deps: ShortcutDeps,
  mode: 'full' | 'region' = 'full'
): Promise<void> {
  const win = deps.getWindow()
  try {
    const shot = await (mode === 'full' ? service.captureScreen() : service.captureRegion())
    if (!shot) return
    const count = deps.buffer.list().filter((i) => i.kind === 'image').length + 1
    deps.buffer.addImage(shot.data, shot.mediaType, 'screen')
    if (win) showAndFocus(win)
    deps.sendCommand({ type: 'focusPrompt' })
    deps.sendCommand({
      type: 'notice',
      tone: 'info',
      message: `Screenshot ${count} added. Capture more, or type a question and press Enter.`
    })
  } catch (error) {
    if (win) showAndFocus(win)
    deps.sendCommand({ type: 'notice', tone: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}

/**
 * (Re)registers global shortcuts from settings. Returns the accelerators that
 * failed to register, usually because another app already owns them.
 */
export function registerShortcuts(settings: ShortcutSettings, deps: ShortcutDeps): string[] {
  globalShortcut.unregisterAll()
  const failed: string[] = []
  const bind = (accelerator: string, handler: () => void): void => {
    if (!accelerator) return
    try {
      if (!globalShortcut.register(accelerator, handler)) failed.push(accelerator)
    } catch {
      failed.push(accelerator)
    }
  }
  const withWindow = (handler: (win: BrowserWindow) => void) => () => {
    const win = deps.getWindow()
    if (win) handler(win)
  }

  bind(
    settings.customPrompt,
    withWindow((win) => {
      showAndFocus(win)
      deps.sendCommand({ type: 'focusPrompt' })
    })
  )
  bind(
    settings.solveContext,
    withWindow((win) => {
      win.showInactive()
      deps.sendCommand({ type: 'solveContext' })
    })
  )
  bind(settings.captureClipboard, () => {
    void captureClipboard(deps.buffer)
  })
  bind(
    settings.toggleWindow,
    withWindow((win) => {
      // Always-on-top means visible is on screen; hide it even when another app has focus.
      if (win.isVisible()) win.hide()
      else showAndFocus(win)
    })
  )
  // Scrolling and moving work without focusing the overlay, so the app underneath keeps the keyboard.
  bind(settings.scrollUp, () => deps.sendCommand({ type: 'scroll', direction: 'up' }))
  bind(settings.scrollDown, () => deps.sendCommand({ type: 'scroll', direction: 'down' }))
  if (settings.moveWindowModifier) {
    for (const direction of ['Left', 'Right', 'Up', 'Down'] as const) {
      bind(`${settings.moveWindowModifier}+${direction}`, withWindow((win) => nudgeWindow(win, direction)))
    }
  }
  if (deps.screenCapture) {
    const service = deps.screenCapture
    bind(settings.captureScreen, () => void captureScreen(service, deps))
    bind(settings.captureRegion, () => void captureScreen(service, deps, 'region'))
  }
  if (deps.toggleRecording) bind(settings.toggleRecording, deps.toggleRecording)
  return failed
}
