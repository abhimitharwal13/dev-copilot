/**
 * Rectangle math for the screen region picker. Pure, so the picker page and
 * the main process share it and it can be unit tested without Electron.
 */

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

/** Which corner the arrow keys move; Tab switches between them. */
export type Corner = 'start' | 'end'

/** The smallest selection the picker allows, in screen points. */
export const MIN_REGION = 16

/** The rectangle spanned by two points, whichever order they are in. */
export function rectFromPoints(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) }
}

/**
 * Moves one corner of the selection by (dx, dy), keeping it inside the screen
 * and at least MIN_REGION wide and tall. `start` is the top-left corner.
 */
export function moveCorner(rect: Rect, corner: Corner, dx: number, dy: number, bounds: Size): Rect {
  const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi)
  let left = rect.x
  let top = rect.y
  let right = rect.x + rect.width
  let bottom = rect.y + rect.height
  if (corner === 'start') {
    left = clamp(left + dx, 0, right - MIN_REGION)
    top = clamp(top + dy, 0, bottom - MIN_REGION)
  } else {
    right = clamp(right + dx, left + MIN_REGION, bounds.width)
    bottom = clamp(bottom + dy, top + MIN_REGION, bounds.height)
  }
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/** Moves the whole selection, stopping at the screen edges. */
export function moveRect(rect: Rect, dx: number, dy: number, bounds: Size): Rect {
  const x = Math.min(Math.max(rect.x + dx, 0), bounds.width - rect.width)
  const y = Math.min(Math.max(rect.y + dy, 0), bounds.height - rect.height)
  return { ...rect, x, y }
}

/**
 * Converts a selection in screen points to whole image pixels, given the
 * captured image's real size (Retina screens capture at 2x or more).
 */
export function toImagePixels(rect: Rect, screen: Size, image: Size): Rect {
  const sx = image.width / screen.width
  const sy = image.height / screen.height
  const x = Math.max(0, Math.round(rect.x * sx))
  const y = Math.max(0, Math.round(rect.y * sy))
  return {
    x,
    y,
    width: Math.max(1, Math.min(image.width - x, Math.round(rect.width * sx))),
    height: Math.max(1, Math.min(image.height - y, Math.round(rect.height * sy)))
  }
}

/** Scales a size down (never up) so its longer edge is at most `maxEdge`. */
export function fitWithin(size: Size, maxEdge: number): Size {
  const longest = Math.max(size.width, size.height)
  if (longest <= maxEdge) return size
  const scale = maxEdge / longest
  return { width: Math.max(1, Math.round(size.width * scale)), height: Math.max(1, Math.round(size.height * scale)) }
}
