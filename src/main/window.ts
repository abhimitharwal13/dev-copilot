import { join } from 'node:path'
import { app, BrowserWindow, screen, shell } from 'electron'
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
    // No vibrancy: its blur hides the page behind. Translucency comes from the CSS alpha alone.
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  applyOverlaySettings(win, overlay)
  // Chromium resets zoom on navigation and can remember a stray zoom per page; the setting always wins.
  win.webContents.on('did-finish-load', () => win.webContents.setZoomFactor(zoom))
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

/** Text size from settings, re-applied after every page load. */
let zoom = 1

export function applyOverlaySettings(win: BrowserWindow, overlay: OverlaySettings): void {
  zoom = overlay.zoom
  win.webContents.setZoomFactor(zoom)
  // 'screen-saver' keeps the overlay above other windows, including a full-screen browser.
  win.setAlwaysOnTop(overlay.alwaysOnTop, 'screen-saver')
  // Click-through: the mouse works the app behind (drawing, scrolling); the overlay stays keyboard-driven.
  win.setIgnoreMouseEvents(overlay.clickThrough)
  // macOS gives each full-screen app its own Space; without this the overlay
  // stays behind on the desktop Space and never shows over a full-screen browser.
  if (process.platform === 'darwin') {
    win.setVisibleOnAllWorkspaces(overlay.alwaysOnTop, { visibleOnFullScreen: overlay.alwaysOnTop })
  }
}

/** Brings the overlay forward and gives it keyboard focus. */
export function showAndFocus(win: BrowserWindow): void {
  if (win.isMinimized()) win.restore()
  win.show()
  // macOS only lets a background app take the keyboard when it asks to steal focus; without
  // this the overlay shows but keys (Esc, typing) still go to the app underneath.
  if (process.platform === 'darwin') app.focus({ steal: true })
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
