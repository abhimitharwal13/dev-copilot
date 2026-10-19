import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  clipboard: {},
  globalShortcut: {},
  screen: {},
  shell: {},
  BrowserWindow: class {}
}))
vi.mock('../src/main/window', () => ({ showAndFocus: vi.fn(), nudgeWindow: vi.fn() }))

const { ContextBuffer } = await import('../src/main/inputs/ContextBuffer')
const { captureScreen } = await import('../src/main/inputs/shortcuts')
const { showAndFocus } = await import('../src/main/window')
import type { UiCommand } from '../src/shared/types'
import type { ScreenCaptureService } from '../src/main/inputs/InputSource'

function setup(capture: ScreenCaptureService['captureScreen']) {
  const buffer = new ContextBuffer()
  const commands: UiCommand[] = []
  const win = {} as never
  const deps = { buffer, getWindow: () => win, sendCommand: (c: UiCommand) => commands.push(c) }
  return { buffer, commands, run: () => captureScreen({ captureScreen: capture, captureRegion: capture }, deps) }
}

describe('captureScreen', () => {
  it('adds the screenshot to the buffer and focuses the prompt', async () => {
    const { buffer, commands, run } = setup(async () => ({ data: 'AAAA', mediaType: 'image/png' }))
    await run()
    await run()
    expect(buffer.list()).toMatchObject([
      { kind: 'image', source: 'screen', data: 'AAAA', mediaType: 'image/png' },
      { kind: 'image', source: 'screen' }
    ])
    expect(commands).toContainEqual({ type: 'focusPrompt' })
    expect(commands.at(-1)).toMatchObject({ type: 'notice', tone: 'info', message: expect.stringContaining('Screenshot 2 added') })
    expect(showAndFocus).toHaveBeenCalled()
  })

  it('takes the whole screen by default and the picker only in region mode', async () => {
    const full = vi.fn(async () => ({ data: 'FULL', mediaType: 'image/png' as const }))
    const region = vi.fn(async () => ({ data: 'PART', mediaType: 'image/png' as const }))
    const buffer = new ContextBuffer()
    const deps = { buffer, getWindow: () => null, sendCommand: () => {} }
    await captureScreen({ captureScreen: full, captureRegion: region }, deps)
    expect(region).not.toHaveBeenCalled()
    await captureScreen({ captureScreen: full, captureRegion: region }, deps, 'region')
    expect(buffer.list().map((i) => i.kind === 'image' && i.data)).toEqual(['FULL', 'PART'])
  })

  it('does nothing when the picker is cancelled', async () => {
    const { buffer, commands, run } = setup(async () => null)
    await run()
    expect(buffer.list()).toEqual([])
    expect(commands).toEqual([])
  })

  it('shows the permission message when capture is refused', async () => {
    const { buffer, commands, run } = setup(async () => {
      throw new Error('Dev Copilot needs Screen Recording permission.')
    })
    await run()
    expect(buffer.list()).toEqual([])
    expect(commands).toEqual([{ type: 'notice', tone: 'error', message: 'Dev Copilot needs Screen Recording permission.' }])
  })
})
