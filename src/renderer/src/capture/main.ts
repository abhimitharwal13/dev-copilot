import { type Corner, moveCorner, moveRect, MIN_REGION, type Rect, rectFromPoints } from '../../../shared/region'
import './capture.css'

/**
 * The screen region picker. Keyboard first: arrows move the highlighted
 * corner, Tab switches corners, Enter captures. Dragging with the mouse works too.
 */
const STEP = 20
const BIG_STEP = 100
const FINE_STEP = 2

const api = window.devCopilot.capture
const isMac = navigator.userAgent.includes('Mac')
const shot = document.getElementById('shot') as HTMLImageElement
const selection = document.getElementById('selection') as HTMLDivElement
const sizeLabel = document.getElementById('size') as HTMLSpanElement
const help = document.getElementById('help') as HTMLDivElement

const screenSize = (): { width: number; height: number } => ({ width: window.innerWidth, height: window.innerHeight })
let rect: Rect = { x: 0, y: 0, ...screenSize() }
let corner: Corner = 'start'
let dragFrom: { x: number; y: number } | null = null
let finished = false

const mod = isMac ? '⌘' : 'Ctrl'
help.innerHTML =
  '<kbd>←↑→↓</kbd> move corner · <kbd>Tab</kbd> other corner · <kbd>Shift</kbd> bigger steps · <kbd>Alt</kbd> finer · ' +
  `<kbd>${mod}</kbd> + arrows move box · <kbd>F</kbd> full screen · <kbd>Enter</kbd> capture · <kbd>Esc</kbd> cancel`

function render(): void {
  Object.assign(selection.style, {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`
  })
  selection.dataset.corner = corner
  sizeLabel.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`
  // Keep the help bar out of the way of a selection near the top.
  help.style.opacity = rect.y < 64 && rect.height < screenSize().height - 8 ? '0.25' : '1'
}

function finish(result: Rect | null): void {
  if (finished) return
  finished = true
  api.done(result)
}

window.addEventListener('keydown', (e) => {
  e.preventDefault()
  const step = e.shiftKey ? BIG_STEP : e.altKey ? FINE_STEP : STEP
  const delta: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step]
  }
  if (e.key in delta) {
    const [dx, dy] = delta[e.key]
    rect = e.ctrlKey || e.metaKey ? moveRect(rect, dx, dy, screenSize()) : moveCorner(rect, corner, dx, dy, screenSize())
  } else if (e.key === 'Tab') {
    corner = corner === 'start' ? 'end' : 'start'
  } else if (e.key === 'f' || e.key === 'F') {
    rect = { x: 0, y: 0, ...screenSize() }
  } else if (e.key === 'Enter' || e.key === ' ') {
    finish(rect)
  } else if (e.key === 'Escape') {
    finish(null)
  }
  render()
})

window.addEventListener('mousedown', (e) => {
  dragFrom = { x: e.clientX, y: e.clientY }
})
window.addEventListener('mousemove', (e) => {
  if (!dragFrom) return
  rect = rectFromPoints(dragFrom, { x: e.clientX, y: e.clientY })
  corner = 'end'
  render()
})
window.addEventListener('mouseup', (e) => {
  if (!dragFrom) return
  const dragged = rectFromPoints(dragFrom, { x: e.clientX, y: e.clientY })
  dragFrom = null
  // A plain click keeps the current selection; a real drag captures straight away.
  if (dragged.width >= MIN_REGION && dragged.height >= MIN_REGION) finish(dragged)
})
window.addEventListener('resize', () => {
  rect = { x: 0, y: 0, ...screenSize() }
  render()
})

void api.image().then((url) => {
  if (!url) return finish(null)
  shot.src = url
  render()
})
render()
