import mermaid from 'mermaid'
import { useEffect, useId, useState } from 'react'

mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'dark', fontFamily: 'inherit' })

/** Renders a Mermaid block; falls back to the source while streaming or on syntax errors. */
export function Mermaid({ code, final }: { code: string; final: boolean }) {
  const id = `mmd-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  if (svg) return <div className="mermaid" dangerouslySetInnerHTML={{ __html: svg }} />
  return (
    <div className="mermaid mermaid--pending">
      {error && <div className="mermaid__error">Diagram could not be rendered: {error}</div>}
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}
