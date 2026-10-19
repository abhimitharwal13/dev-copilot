import { join } from 'node:path'
import {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  type NativeImage,
  screen,
  shell,
  systemPreferences,
  type Display
} from 'electron'
import { IPC } from '../../shared/ipc'
import { fitWithin, type Rect, toImagePixels } from '../../shared/region'
import type { CapturedImage, ScreenCaptureService } from './InputSource'

/** Longest edge sent to models: large enough that code in a screenshot stays legible. */
const MAX_EDGE = 2576
/** Raw bytes before falling back to JPEG; base64 adds a third, and providers cap images near 5 MB. */
const MAX_PNG_BYTES = 3_700_000
/** Time for the overlay to leave the screen before the screenshot is taken. */
const HIDE_DELAY_MS = 220

const MAC_PRIVACY_PANE = 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'

/** Thrown when the OS has not allowed this app to record the screen. */
export class ScreenPermissionError extends Error {
  constructor() {
    super(
      'Dev Copilot needs Screen Recording permission. Turn it on in System Settings > Privacy & Security > ' +
        'Screen & System Audio Recording, then quit and reopen Dev Copilot.'
    )
    this.name = 'ScreenPermissionError'
  }
}

interface PickerSession {
  window: BrowserWindow
  preview: string
  resolve(rect: Rect | null): void
}

/**
 * Freezes the display under the cursor, lets the user select a region on a
 * full-screen picker (keyboard or mouse), and returns the crop.
 */
export class ElectronScreenCapture implements ScreenCaptureService {
  private running: Promise<CapturedImage | null> | null = null
  private session: PickerSession | null = null

  constructor(private readonly getOverlay: () => BrowserWindow | null) {
    ipcMain.handle(IPC.captureImage, (e) =>
      this.session && e.sender === this.session.window.webContents ? this.session.preview : null
    )
    ipcMain.on(IPC.captureDone, (e, rect: unknown) => {
      if (this.session && e.sender === this.session.window.webContents) this.session.resolve(parseRect(rect))
    })
  }

  captureRegion(): Promise<CapturedImage | null> {
    // A second press while the picker is open does nothing new.
    this.running ??= this.run().finally(() => (this.running = null))
    return this.running
  }

  private async run(): Promise<CapturedImage | null> {
    if (process.platform === 'darwin') {
      const status = systemPreferences.getMediaAccessStatus('screen')
      if (status === 'denied' || status === 'restricted') throw this.permissionError()
    }
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    const overlay = this.getOverlay()
    const overlayWasVisible = overlay?.isVisible() ?? false
    if (overlayWasVisible) {
      overlay!.hide()
      await new Promise((r) => setTimeout(r, HIDE_DELAY_MS))
    }
    try {
      const image = await grabDisplay(display)
      // macOS hands back a wallpaper-only image instead of failing when access is missing.
      if (image.isEmpty() || (process.platform === 'darwin' && systemPreferences.getMediaAccessStatus('screen') !== 'granted')) {
        throw this.permissionError()
      }
      const rect = await this.pick(display, image)
      if (!rect) return null
      return encode(image.crop(toImagePixels(rect, display.bounds, image.getSize())))
    } finally {
      if (overlayWasVisible && overlay && !overlay.isDestroyed()) overlay.showInactive()
    }
  }

  private permissionError(): ScreenPermissionError {
    if (process.platform === 'darwin') void shell.openExternal(MAC_PRIVACY_PANE)
    return new ScreenPermissionError()
  }

  private pick(display: Display, image: NativeImage): Promise<Rect | null> {
    const { x, y, width, height } = display.bounds
    const win = new BrowserWindow({
      x,
      y,
      width,
      height,
      show: false,
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      // Lets the picker cover the macOS menu bar too.
      enableLargerThanScreen: true,
      skipTaskbar: true,
      hasShadow: false,
      backgroundColor: '#000000',
      title: 'Select a region',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })
    win.setAlwaysOnTop(true, 'screen-saver')
    if (process.platform === 'darwin') win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    win.setBounds(display.bounds)

    return new Promise((resolve) => {
      const finish = (rect: Rect | null): void => {
        if (this.session?.window !== win) return
        this.session = null
        if (!win.isDestroyed()) win.destroy()
        resolve(rect)
      }
      this.session = { window: win, preview: `data:image/jpeg;base64,${image.toJPEG(90).toString('base64')}`, resolve: finish }
      win.on('closed', () => finish(null))
      win.once('ready-to-show', () => {
        if (process.platform === 'darwin') app.focus({ steal: true })
        win.show()
        win.focus()
        win.webContents.focus()
      })
      if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/capture.html`)
      else void win.loadFile(join(__dirname, '../renderer/capture.html'))
    })
  }
}

async function grabDisplay(display: Display): Promise<NativeImage> {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.round(display.bounds.width * display.scaleFactor),
      height: Math.round(display.bounds.height * display.scaleFactor)
    }
  })
  const source = sources.find((s) => s.display_id === String(display.id)) ?? sources[0]
  if (!source) throw new Error('No screen is available to capture.')
  return source.thumbnail
}

function encode(image: NativeImage): CapturedImage {
  const size = image.getSize()
  const target = fitWithin(size, MAX_EDGE)
  const scaled = target === size ? image : image.resize({ ...target, quality: 'best' })
  const png = scaled.toPNG()
  if (png.length <= MAX_PNG_BYTES) return { data: png.toString('base64'), mediaType: 'image/png' }
  return { data: scaled.toJPEG(88).toString('base64'), mediaType: 'image/jpeg' }
}

function parseRect(value: unknown): Rect | null {
  if (!value || typeof value !== 'object') return null
  const { x, y, width, height } = value as Record<string, unknown>
  const nums = [x, y, width, height]
  if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n))) return null
  if ((width as number) < 1 || (height as number) < 1) return null
  return { x: x as number, y: y as number, width: width as number, height: height as number }
}
