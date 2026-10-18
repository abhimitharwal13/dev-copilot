import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import type {
  ContextItem,
  ProblemType,
  ProviderInfo,
  PublicSettings,
  SettingsPatch,
  UiCommand
} from '../../shared/types'
import { PROBLEM_TYPE_LABELS } from '../../shared/types'
import { api } from './api'
import { Composer, FOLLOW_UPS } from './components/Composer'
import { ContextPanel } from './components/ContextPanel'
import { Markdown } from './components/Markdown'
import { SettingsDialog } from './components/SettingsDialog'
import { ShortcutHelp } from './components/ShortcutHelp'
import { useSolve } from './hooks/useSolve'
import { IS_MAC, prettyAccelerator, useKeyMap, type KeyMap } from './keyboard'

const TYPE_ORDER: ProblemType[] = ['dsa', 'lld', 'hld']
const SHORT_LABEL: Record<ProblemType, string> = { dsa: 'DSA', lld: 'LLD', hld: 'System Design' }
const MOD = IS_MAC ? '⌘' : 'Ctrl'
const OPACITY_STEP = 0.08

/** Last fenced code block in a Markdown answer, skipping diagrams. */
function lastCodeBlock(markdown: string): string | undefined {
  const blocks = [...markdown.matchAll(/```([\w+#-]*)\n([\s\S]*?)```/g)].filter((m) => m[1] !== 'mermaid')
  return blocks.at(-1)?.[2].replace(/\n$/, '')
}

export function App() {
  const [settings, setSettings] = useState<PublicSettings | null>(null)
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [context, setContext] = useState<ContextItem[]>([])
  const [dialog, setDialog] = useState<'settings' | 'help' | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  /** Type picked before the first question; `undefined` follows settings. */
  const [typeOverride, setTypeOverride] = useState<ProblemType | undefined>()
  const { state, ask, cancel, reset } = useSolve()
  const conversation = useRef<HTMLElement>(null)
  const prompt = useRef<HTMLTextAreaElement>(null)
  /** Follow the stream only while the user hasn't scrolled away from the bottom. */
  const stickToBottom = useRef(true)

  useEffect(() => {
    void api.settings.get().then(setSettings)
    void api.providers.list().then(setProviders)
    void api.context.list().then(setContext)
    return api.context.onChanged(setContext)
  }, [])

  const lastAnswerLength = state.turns[state.turns.length - 1]?.answer.length ?? 0
  useEffect(() => {
    const el = conversation.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [state.turns.length, lastAnswerLength])

  const flash = (message: string): void => {
    setToast(message)
    setTimeout(() => setToast((t) => (t === message ? null : t)), 1600)
  }

  const saveSettings = useCallback(async (patch: SettingsPatch) => {
    setSettings(await api.settings.update(patch))
  }, [])

  const submit = (text: string): void => {
    if (!text.trim() && context.length === 0) {
      flash('Type a prompt or capture some context first')
      return
    }
    stickToBottom.current = true
    void ask(text, { problemType: state.turns.length === 0 ? typeOverride : undefined })
  }

  const newProblem = (): void => {
    reset()
    setTypeOverride(undefined)
    prompt.current?.focus()
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

  const scroll = (direction: 'up' | 'down'): void => {
    const el = conversation.current
    if (!el) return
    el.scrollBy({ top: (direction === 'up' ? -0.8 : 0.8) * el.clientHeight })
  }

  const changeOpacity = (delta: number): void => {
    if (!settings) return
    const next = Math.round((settings.overlay.backgroundOpacity + delta) * 100) / 100
    void saveSettings({ overlay: { backgroundOpacity: next } })
  }

  const isFollowUp = state.turns.some((t) => t.status === 'done')
  const lastAnswer = state.turns.at(-1)?.answer ?? ''

  // Global shortcuts arrive from main as commands, even when another app has focus.
  const onCommand = useRef<(c: UiCommand) => void>(() => {})
  onCommand.current = (command) => {
    if (command.type === 'focusPrompt') {
      setDialog(null)
      prompt.current?.focus()
      prompt.current?.select()
    } else if (command.type === 'solveContext') {
      if (!state.busy) submit('')
    } else {
      scroll(command.direction)
    }
  }
  useEffect(() => api.ui.onCommand((c) => onCommand.current(c)), [])

  const keyMap: KeyMap = {
    Escape: () => {
      if (state.busy) cancel()
      else void api.ui.hideWindow()
    },
    'CommandOrControl+L': () => prompt.current?.focus(),
    'CommandOrControl+N': newProblem,
    'CommandOrControl+,': () => setDialog('settings'),
    'CommandOrControl+/': () => setDialog('help'),
    F1: () => setDialog('help'),
    'CommandOrControl+Shift+C': () => {
      const code = lastCodeBlock(lastAnswer)
      if (!code) return flash('No code block to copy yet')
      void navigator.clipboard.writeText(code).then(() => flash('Copied the last code block'))
    },
    'CommandOrControl+Shift+X': () => void api.context.clear(),
    'CommandOrControl+Shift+Backspace': () => {
      const newest = context.at(-1)
      if (newest) void api.context.remove(newest.id)
    },
    'CommandOrControl+[': () => changeOpacity(-OPACITY_STEP),
    'CommandOrControl+]': () => changeOpacity(OPACITY_STEP),
    PageUp: () => scroll('up'),
    PageDown: () => scroll('down'),
    'Alt+Up': () => scroll('up'),
    'Alt+Down': () => scroll('down')
  }
  TYPE_ORDER.forEach((t, i) => (keyMap[`CommandOrControl+${i + 1}`] = () => switchType(t)))
  const answerType = state.detection?.type ?? typeOverride ?? 'dsa'
  if (isFollowUp && !state.busy) {
    FOLLOW_UPS[answerType].forEach(({ prompt }, i) => (keyMap[`Alt+${i + 1}`] = () => submit(prompt)))
  }
  // Dialogs own the keyboard while open (including recording new shortcuts).
  useKeyMap(dialog ? {} : keyMap)

  if (!settings) return <div className="loading">Loading…</div>

  const active = providers.find((p) => p.id === settings.activeProvider)
  const needsKey = active?.requiresApiKey && !settings.providers[settings.activeProvider].hasApiKey
  const currentType = state.detection?.type ?? typeOverride
  const style = { '--bg-alpha': settings.overlay.backgroundOpacity } as CSSProperties

  return (
    <div className="app" style={style}>
      <header className="topbar">
        <div className="brand">Dev Copilot</div>
        <div className="types" role="radiogroup" aria-label="Problem type">
          {TYPE_ORDER.map((t, i) => (
            <button
              key={t}
              type="button"
              role="radio"
              tabIndex={-1}
              aria-checked={currentType === t}
              title={`${PROBLEM_TYPE_LABELS[t]} (${MOD} + ${i + 1})`}
              className={currentType === t ? 'active' : ''}
              onClick={() => switchType(t)}
            >
              {SHORT_LABEL[t]} <kbd>{i + 1}</kbd>
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
          <span className="provider">
            {active?.label ?? settings.activeProvider} · {settings.providers[settings.activeProvider].model} ·{' '}
            {settings.preferredLanguage}
          </span>
          <span className="hint">
            <kbd>{MOD} + ,</kbd> settings · <kbd>{MOD} + /</kbd> keys · <kbd>Esc</kbd> hide
          </span>
        </div>
      </header>

      <div className="body">
        <ContextPanel items={context} captureShortcut={settings.shortcuts.captureClipboard} />

        <main
          className="conversation"
          ref={conversation}
          tabIndex={-1}
          onScroll={(e) => {
            const el = e.currentTarget
            stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
          }}
        >
          {needsKey && (
            <div className="banner">
              Add an API key for {active?.label}: press <kbd>{MOD} + ,</kbd> to open settings.
            </div>
          )}
          {state.detection?.alternative && state.detection.method !== 'manual' && (
            <div className="banner banner--info">
              This is often asked as {SHORT_LABEL[state.detection.alternative]} too. Answering as{' '}
              {SHORT_LABEL[state.detection.type]}; press{' '}
              <kbd>
                {MOD} + {TYPE_ORDER.indexOf(state.detection.alternative) + 1}
              </kbd>{' '}
              for {SHORT_LABEL[state.detection.alternative]} instead.
            </div>
          )}
          {state.turns.length === 0 ? (
            <div className="empty">
              <h1>Paste a problem. Get a structured breakdown.</h1>
              <p>
                Press <kbd>{prettyAccelerator(settings.shortcuts.customPrompt)}</kbd> from any app to type a prompt
                here, or <kbd>{prettyAccelerator(settings.shortcuts.captureClipboard)}</kbd> to capture the clipboard
                and <kbd>{prettyAccelerator(settings.shortcuts.solveContext)}</kbd> to solve it.
              </p>
            </div>
          ) : (
            state.turns.map((turn, i) => (
              <section key={turn.id} className="turn">
                <div className="turn__prompt">{turn.prompt || (i === 0 ? 'Solve the attached context' : '')}</div>
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
        </main>
      </div>

      <footer className="footer">
        <Composer
          isFollowUp={isFollowUp}
          problemType={answerType}
          busy={state.busy}
          onSubmit={submit}
          onCancel={cancel}
          textareaRef={prompt}
        />
      </footer>

      {toast && <div className="toast">{toast}</div>}

      {dialog === 'settings' && (
        <SettingsDialog
          settings={settings}
          providers={providers}
          onSave={saveSettings}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'help' && <ShortcutHelp shortcuts={settings.shortcuts} onClose={() => setDialog(null)} />}
    </div>
  )
}
