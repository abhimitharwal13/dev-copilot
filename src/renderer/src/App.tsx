import { useCallback, useEffect, useRef, useState } from 'react'
import type { ContextItem, ProblemType, ProviderInfo, PublicSettings, SettingsPatch } from '../../shared/types'
import { PROBLEM_TYPE_LABELS } from '../../shared/types'
import { api } from './api'
import { Composer } from './components/Composer'
import { ContextPanel } from './components/ContextPanel'
import { Markdown } from './components/Markdown'
import { SettingsDialog } from './components/SettingsDialog'
import { useSolve } from './hooks/useSolve'

const TYPE_ORDER: ProblemType[] = ['dsa', 'lld', 'hld']
const SHORT_LABEL: Record<ProblemType, string> = { dsa: 'DSA', lld: 'LLD', hld: 'System Design' }

export function App() {
  const [settings, setSettings] = useState<PublicSettings | null>(null)
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [context, setContext] = useState<ContextItem[]>([])
  const [showSettings, setShowSettings] = useState(false)
  /** Type picked before the first question; `undefined` follows settings. */
  const [typeOverride, setTypeOverride] = useState<ProblemType | undefined>()
  const { state, ask, cancel, reset } = useSolve()
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void api.settings.get().then(setSettings)
    void api.providers.list().then(setProviders)
    void api.context.list().then(setContext)
    return api.context.onChanged(setContext)
  }, [])

  const lastAnswerLength = state.turns[state.turns.length - 1]?.answer.length ?? 0
  useEffect(() => {
    // Braces matter: newer Chromium returns a promise from scrollIntoView, which React would treat as a cleanup.
    void bottom.current?.scrollIntoView({ block: 'end' })
  }, [state.turns.length, lastAnswerLength])

  const saveSettings = useCallback(async (patch: SettingsPatch) => {
    setSettings(await api.settings.update(patch))
  }, [])

  const onSubmit = (prompt: string): void => {
    if (!prompt.trim() && context.length === 0) return
    void ask(prompt, { problemType: state.turns.length === 0 ? typeOverride : undefined })
  }

  const newProblem = (): void => {
    reset()
    setTypeOverride(undefined)
  }

  /** Changing the type mid-conversation re-runs the first question with the new template. */
  const switchType = (type: ProblemType): void => {
    if (state.turns.length === 0) {
      setTypeOverride(type === typeOverride ? undefined : type)
      return
    }
    if (state.busy || type === state.detection?.type) return
    const firstPrompt = state.turns[0].prompt
    reset()
    setTypeOverride(type)
    void ask(firstPrompt, { problemType: type })
  }

  if (!settings) return <div className="loading">Loading…</div>

  const active = providers.find((p) => p.id === settings.activeProvider)
  const needsKey = active?.requiresApiKey && !settings.providers[settings.activeProvider].hasApiKey
  const currentType = state.detection?.type ?? typeOverride
  const isFollowUp = state.turns.some((t) => t.status === 'done')

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Dev Copilot</div>
        <div className="types" role="radiogroup" aria-label="Problem type">
          {TYPE_ORDER.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={currentType === t}
              title={PROBLEM_TYPE_LABELS[t]}
              className={currentType === t ? 'active' : ''}
              onClick={() => switchType(t)}
            >
              {SHORT_LABEL[t]}
            </button>
          ))}
          {state.detection && (
            <span className="detected">
              {state.detection.method === 'manual'
                ? 'chosen'
                : `auto · ${Math.round(state.detection.confidence * 100)}%${state.detection.method === 'llm' ? ' · model' : ''}`}
            </span>
          )}
        </div>
        <div className="topbar__right">
          {isFollowUp && (
            <button type="button" className="secondary" onClick={newProblem}>
              New problem
            </button>
          )}
          <button type="button" className="provider" onClick={() => setShowSettings(true)}>
            {active?.label ?? settings.activeProvider} · {settings.providers[settings.activeProvider].model}
          </button>
        </div>
      </header>

      <div className="body">
        <ContextPanel items={context} captureShortcut={settings.shortcuts.captureClipboard} />

        <main className="conversation">
          {needsKey && (
            <div className="banner">
              Add an API key for {active?.label} in{' '}
              <button type="button" className="link" onClick={() => setShowSettings(true)}>
                settings
              </button>{' '}
              to start.
            </div>
          )}
          {state.turns.length === 0 ? (
            <div className="empty">
              <h1>Paste a problem. Get a structured breakdown.</h1>
              <p>
                Coding problems get approach, complexity, code and edge cases. Low-level design gets classes, patterns
                and Mermaid diagrams. System design gets requirements, estimates, APIs, architecture and trade-offs.
              </p>
            </div>
          ) : (
            state.turns.map((turn, i) => (
              <section key={turn.id} className="turn">
                <div className="turn__prompt">
                  {turn.prompt || (i === 0 ? 'Solve the attached context' : '')}
                </div>
                {turn.answer && <Markdown text={turn.answer} final={turn.status !== 'streaming'} />}
                {turn.status === 'streaming' && !turn.answer && <div className="thinking">Analyzing…</div>}
                {turn.status === 'error' && <div className="error">{turn.error}</div>}
                {turn.status === 'cancelled' && <div className="muted">Stopped.</div>}
                {turn.usage?.outputTokens !== undefined && (
                  <div className="muted small">
                    {turn.usage.inputTokens ?? '?'} in · {turn.usage.outputTokens} out tokens
                  </div>
                )}
              </section>
            ))
          )}
          <div ref={bottom} />
        </main>
      </div>

      <footer className="footer">
        <Composer isFollowUp={isFollowUp} busy={state.busy} onSubmit={onSubmit} onCancel={cancel} />
      </footer>

      {showSettings && (
        <SettingsDialog
          settings={settings}
          providers={providers}
          onSave={saveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
