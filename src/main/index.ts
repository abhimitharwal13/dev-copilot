import { join } from 'node:path'
import { app, BrowserWindow, globalShortcut, safeStorage, shell } from 'electron'
import { IPC } from '../shared/ipc'
import { ContextBuffer } from './inputs/ContextBuffer'
import { registerShortcuts } from './inputs/shortcuts'
import { registerIpcHandlers } from './ipc/handlers'
import { SolvePipeline } from './pipeline/pipeline'
import { createProvider } from './providers/registry'
import { type SecretCodec, SettingsStore } from './settings/SettingsStore'

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

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 880,
    minHeight: 600,
    show: false,
    title: 'Dev Copilot',
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  win.once('ready-to-show', () => win.show())
  // Links in answers open in the system browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault()
  })

  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
  return win
}

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

  registerIpcHandlers({ settings, buffer, pipeline, getWindow: () => mainWindow })
  mainWindow = createWindow()
  mainWindow.on('closed', () => (mainWindow = null))

  const shortcutDeps = { buffer, getWindow: () => mainWindow }
  const reportFailures = (failed: string[]): void => {
    if (failed.length) console.warn(`Could not register shortcuts: ${failed.join(', ')}`)
  }
  reportFailures(registerShortcuts(settings.get().shortcuts, shortcutDeps))
  settings.onChange((s) => reportFailures(registerShortcuts(s.shortcuts, shortcutDeps)))

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow()
  })
})

app.on('will-quit', () => globalShortcut.unregisterAll())
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
