import { join } from 'node:path'
import { app, BrowserWindow, globalShortcut, ipcMain, safeStorage } from 'electron'
import { IPC } from '../shared/ipc'
import type { UiCommand } from '../shared/types'
import { ContextBuffer } from './inputs/ContextBuffer'
import { ElectronScreenCapture } from './inputs/ScreenCapture'
import { registerShortcuts } from './inputs/shortcuts'
import { registerIpcHandlers } from './ipc/handlers'
import { SolvePipeline } from './pipeline/pipeline'
import { createProvider } from './providers/registry'
import { type SecretCodec, SettingsStore } from './settings/SettingsStore'
import { applyOverlaySettings, createOverlayWindow, showAndFocus } from './window'

let mainWindow: BrowserWindow | null = null

/** Uses the OS keychain when available; otherwise keys stay base64 on disk with a warning. */
const secretCodec: SecretCodec = {
  encrypt: (plain) =>
    safeStorage.isEncryptionAvailable()
      ? `enc:${safeStorage.encryptString(plain).toString('base64')}`
      : `b64:${Buffer.from(plain, 'utf8').toString('base64')}`,
  decrypt: (encoded) => {
    const [scheme, payload] = [encoded.slice(0, 4), encoded.slice(4)]
    if (scheme === 'enc:') return safeStorage.decryptString(Buffer.from(payload, 'base64'))
    if (scheme === 'b64:') return Buffer.from(payload, 'base64').toString('utf8')
    throw new Error('Unknown secret encoding')
  }
}

// Launching the app again (e.g. double-clicking its icon) focuses the running overlay.
if (!app.requestSingleInstanceLock()) app.quit()
app.on('second-instance', () => {
  if (mainWindow) showAndFocus(mainWindow)
})

void app.whenReady().then(() => {
  const settings = new SettingsStore(join(app.getPath('userData'), 'settings.json'), secretCodec)
  const buffer = new ContextBuffer()
  const pipeline = new SolvePipeline({
    getSettings: () => settings.get(),
    getProvider: () => {
      const s = settings.get()
      return createProvider(s.activeProvider, s.providers[s.activeProvider])
    },
    getContext: (ids) => buffer.select(ids),
    emit: (event) => mainWindow?.webContents.send(IPC.solveEvent, event)
  })

  const openWindow = (): BrowserWindow => {
    const win = createOverlayWindow(settings.get().overlay)
    win.on('closed', () => (mainWindow = null))
    return win
  }

  registerIpcHandlers({ settings, buffer, pipeline, getWindow: () => mainWindow })
  mainWindow = openWindow()

  let failedShortcuts: string[] = []
  ipcMain.handle(IPC.shortcutsFailed, () => failedShortcuts)
  const shortcutDeps = {
    buffer,
    getWindow: () => mainWindow,
    screenCapture: new ElectronScreenCapture(() => mainWindow),
    sendCommand: (command: UiCommand) => mainWindow?.webContents.send(IPC.uiCommand, command)
  }
  const bindShortcuts = (): void => {
    failedShortcuts = registerShortcuts(settings.get().shortcuts, shortcutDeps)
    if (failedShortcuts.length) console.warn(`Could not register shortcuts: ${failedShortcuts.join(', ')}`)
  }
  bindShortcuts()
  settings.onChange((s) => {
    bindShortcuts()
    if (mainWindow) applyOverlaySettings(mainWindow, s.overlay)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = openWindow()
  })
})

app.on('will-quit', () => globalShortcut.unregisterAll())
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
