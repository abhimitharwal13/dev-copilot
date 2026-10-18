import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { useDialogKeys } from './useDialogKeys'

const ZOOM_STEP = 1.25
const MIN_ZOOM = 0.25
const MAX_ZOOM = 6

/** Natural size of a rendered Mermaid SVG, from its viewBox. */
function naturalSize(svg: SVGSVGElement): { width: number; height: number } {
  const box = svg.viewBox.baseVal
  return box && box.width > 0 ? { width: box.width, height: box.height } : svg.getBBox()
}

/**
 * Full-window view of one diagram from the answer, at real size instead of
 * shrunk to the column. Keyboard only: +/- zoom, 0 fits, arrows scroll,
 * Tab / Shift+Tab cycle diagrams, Ctrl/⌘+S saves the SVG, Esc closes.
 */
export function DiagramViewer({ svgs, start, onClose }: { svgs: string[]; start: number; onClose(): void }) {
  const ref = useDialogKeys<HTMLDivElement>(onClose)
  const stage = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(start)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const svg = stage.current?.querySelector('svg')
    if (!svg) return
    const { width, height } = naturalSize(svg)
    // Mermaid caps the width with an inline max-width; size the SVG explicitly instead.
    svg.style.maxWidth = 'none'
    svg.setAttribute('width', String(width * zoom))
    svg.setAttribute('height', String(height * zoom))
  }, [index, zoom])

  const fit = (): void => {
    const svg = stage.current?.querySelector('svg')
    const el = stage.current
    if (!svg || !el) return
    const { width, height } = naturalSize(svg)
    setZoom(Math.min(el.clientWidth / width, el.clientHeight / height))
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    const key = e.key
    if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === 's') {
      void api.ui.saveFile(`diagram-${index + 1}.svg`, svgs[index])
    } else if (key === '+' || key === '=') setZoom((z) => Math.min(MAX_ZOOM, z * ZOOM_STEP))
    else if (key === '-' || key === '_') setZoom((z) => Math.max(MIN_ZOOM, z / ZOOM_STEP))
    else if (key === '0') fit()
    else if (key === 'Tab' && svgs.length > 1) {
      setIndex((i) => (i + (e.shiftKey ? svgs.length - 1 : 1)) % svgs.length)
      setZoom(1)
    } else if (key === 'Tab') {
      // Keep focus here so arrow keys keep scrolling the stage.
    } else return
    e.preventDefault()
  }

  return (
    <div className="dialog__backdrop">
      <div
        className="dialog diagram-viewer"
        role="dialog"
        aria-label="Diagram viewer"
        ref={ref}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="diagram-viewer__bar muted small">
          Diagram {index + 1} of {svgs.length} · {Math.round(zoom * 100)}% · <kbd>+</kbd> <kbd>-</kbd> zoom ·{' '}
          <kbd>0</kbd> fit · arrows scroll · <kbd>Ctrl + S</kbd> save SVG{svgs.length > 1 ? ' · Tab next' : ''} · <kbd>Esc</kbd> close
        </div>
        <div className="diagram-viewer__stage" ref={stage} tabIndex={0} dangerouslySetInnerHTML={{ __html: svgs[index] }} />
      </div>
    </div>
  )
}
