import { join } from 'node:path'
import { BrowserWindow, screen, shell } from 'electron'
import type { OverlaySettings } from '../shared/types'

/**
 * A frameless, transparent, always-on-top overlay. The page paints a
 * semi-transparent background (see `--bg-alpha` in app.css) so the screen
 * behind stays visible while text stays fully opaque.
 */
export function createOverlayWindow(overlay: OverlaySettings): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay()
  const width = Math.min(1100, Math.round(workArea.width * 0.6))
  const height = Math.min(820, Math.round(workArea.height * 0.85))
  const win = new BrowserWindow({
    width,
    height,
    x: workArea.x + workArea.width - width - 24,
    y: workArea.y + 24,
    minWidth: 560,
    minHeight: 400,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    alwaysOnTop: overlay.alwaysOnTop,
    // A HUD, not an app window: Ctrl/⌘+Shift+Space brings it back.
    skipTaskbar: true,
    title: 'Dev Copilot',
    // Real backdrop blur where the OS offers it; elsewhere the CSS alpha alone gives translucency.
    ...(process.platform === 'darwin' ? { vibrancy: 'under-window' as const, visualEffectState: 'active' as const } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  // 'screen-saver' keeps the overlay above full-screen apps on macOS.
  if (overlay.alwaysOnTop) win.setAlwaysOnTop(true, 'screen-saver')
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

export function applyOverlaySettings(win: BrowserWindow, overlay: OverlaySettings): void {
  win.setAlwaysOnTop(overlay.alwaysOnTop, 'screen-saver')
}

/** Brings the overlay forward and gives it keyboard focus. */
export function showAndFocus(win: BrowserWindow): void {
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  win.webContents.focus()
}

const MOVE_STEP = 48

/** Moves the window by one step, keeping it on the display it is on. */
export function nudgeWindow(win: BrowserWindow, direction: 'Left' | 'Right' | 'Up' | 'Down'): void {
  const bounds = win.getBounds()
  const { workArea } = screen.getDisplayMatching(bounds)
  const dx = direction === 'Left' ? -MOVE_STEP : direction === 'Right' ? MOVE_STEP : 0
  const dy = direction === 'Up' ? -MOVE_STEP : direction === 'Down' ? MOVE_STEP : 0
  const x = Math.min(Math.max(bounds.x + dx, workArea.x), workArea.x + workArea.width - bounds.width)
  const y = Math.min(Math.max(bounds.y + dy, workArea.y), workArea.y + workArea.height - bounds.height)
  win.setPosition(x, y)
}
