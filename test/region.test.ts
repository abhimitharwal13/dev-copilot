import { describe, expect, it } from 'vitest'
import { fitWithin, MIN_REGION, moveCorner, moveRect, rectFromPoints, toImagePixels } from '../src/shared/region'

const screen = { width: 1440, height: 900 }
const full = { x: 0, y: 0, ...screen }

describe('region picker math', () => {
  it('builds a rectangle from two points in any order', () => {
    expect(rectFromPoints({ x: 300, y: 50 }, { x: 100, y: 250 })).toEqual({ x: 100, y: 50, width: 200, height: 200 })
  })

  it('moves the top-left corner without moving the bottom-right one', () => {
    expect(moveCorner(full, 'start', 100, 40, screen)).toEqual({ x: 100, y: 40, width: 1340, height: 860 })
  })

  it('moves the bottom-right corner and clamps it to the screen', () => {
    const rect = { x: 100, y: 100, width: 200, height: 200 }
    expect(moveCorner(rect, 'end', -50, 5000, screen)).toEqual({ x: 100, y: 100, width: 150, height: 800 })
  })

  it('never lets the corners cross or the region shrink below the minimum', () => {
    const rect = { x: 100, y: 100, width: 40, height: 40 }
    expect(moveCorner(rect, 'start', 500, 500, screen)).toEqual({ x: 140 - MIN_REGION, y: 140 - MIN_REGION, width: MIN_REGION, height: MIN_REGION })
    expect(moveCorner(rect, 'start', -500, -500, screen)).toEqual({ x: 0, y: 0, width: 140, height: 140 })
  })

  it('moves the whole box and stops at the edges', () => {
    const rect = { x: 100, y: 100, width: 400, height: 300 }
    expect(moveRect(rect, 2000, -2000, screen)).toEqual({ x: 1040, y: 0, width: 400, height: 300 })
  })

  it('maps points to Retina pixels and stays inside the image', () => {
    const image = { width: 2880, height: 1800 }
    expect(toImagePixels({ x: 10.4, y: 20, width: 100, height: 50 }, screen, image)).toEqual({ x: 21, y: 40, width: 200, height: 100 })
    expect(toImagePixels({ x: 1400, y: 880, width: 100, height: 100 }, screen, image)).toEqual({ x: 2800, y: 1760, width: 80, height: 40 })
  })

  it('downscales only images larger than the limit, keeping the aspect ratio', () => {
    const small = { width: 800, height: 600 }
    expect(fitWithin(small, 2576)).toBe(small)
    expect(fitWithin({ width: 5120, height: 2880 }, 2576)).toEqual({ width: 2576, height: 1449 })
  })
})
