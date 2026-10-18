import { clipboard, globalShortcut, type BrowserWindow } from 'electron'
import type { ShortcutSettings } from '../../shared/types'
import type { ContextBuffer } from './ContextBuffer'
import type { ScreenCaptureService } from './InputSource'

export interface ShortcutDeps {
  buffer: ContextBuffer
  getWindow(): BrowserWindow | null
  /** Absent until the screen capture iteration lands; its shortcut is then skipped. */
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

  bind(settings.captureClipboard, () => {
    void captureClipboard(deps.buffer)
  })
  bind(settings.toggleWindow, () => {
    const win = deps.getWindow()
    if (!win) return
    if (win.isVisible() && win.isFocused()) win.hide()
    else {
      win.show()
      win.focus()
    }
  })
  if (deps.screenCapture) {
    const service = deps.screenCapture
    bind(settings.captureScreen, () => {
      void service.captureRegion().then((shot) => {
        if (shot) deps.buffer.addImage(shot.data, shot.mediaType, 'screen')
      })
    })
  }
  if (deps.toggleRecording) bind(settings.toggleRecording, deps.toggleRecording)
  return failed
}
