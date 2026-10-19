import mermaid from 'mermaid'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict',
  theme: 'dark',
  // A concrete font, not 'inherit': Mermaid sizes boxes by measuring text, and a mismatch clips labels.
  fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  themeVariables: { fontSize: '16px' },
  // SVG text labels: HTML labels were measured narrower than they render, which clipped long names.
  htmlLabels: false,
  flowchart: { nodeSpacing: 28, rankSpacing: 36, padding: 10 },
  sequence: { actorMargin: 40, messageFontSize: 15, actorFontSize: 15, noteFontSize: 14 }
})

/** A wide diagram shrinks to the column only this far; past that it scrolls sideways, so labels stay readable. */
const MIN_SCALE = 0.8

/** Renders a Mermaid block; falls back to the source while streaming or on syntax errors. */
export function Mermaid({ code, final }: { code: string; final: boolean }) {
  const id = `mmd-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = box.current?.querySelector('svg')
    const width = el?.viewBox.baseVal?.width
    if (!el || !width) return
    // Mermaid scales the SVG to fit the column (width 100%, max-width natural); keep a floor on that.
    el.style.width = `max(100%, ${Math.round(width * MIN_SCALE)}px)`
    el.style.maxWidth = `${Math.round(width)}px`
    el.style.height = 'auto'
  }, [svg])

  useEffect(() => {
    // Partial diagrams never parse; wait for the answer to finish.
    if (!final) return
    let cancelled = false
    mermaid
      .render(id, code)
      .then(({ svg }) => !cancelled && (setSvg(svg), setError(null)))
      .catch((e: unknown) => !cancelled && (setSvg(null), setError(e instanceof Error ? e.message : String(e))))
    return () => {
      cancelled = true
    }
  }, [code, final, id])

  if (svg) return <div className="mermaid" ref={box} dangerouslySetInnerHTML={{ __html: svg }} />
  return (
    <div className="mermaid mermaid--pending">
      {error && <div className="mermaid__error">Diagram could not be rendered: {error}</div>}
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}
