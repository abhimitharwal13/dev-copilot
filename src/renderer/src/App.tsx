import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import type {
  ContextItem,
  ProblemType,
  ProviderInfo,
  PublicSettings,
  SettingsPatch,
  UiCommand
} from '../../shared/types'
import { NEXT_SECTION_PROMPT, PROBLEM_TYPE_LABELS } from '../../shared/types'
import { api } from './api'
import { Composer, FOLLOW_UPS } from './components/Composer'
import { ContextPanel } from './components/ContextPanel'
import { DiagramViewer } from './components/DiagramViewer'
import { Markdown } from './components/Markdown'
import { SettingsDialog } from './components/SettingsDialog'
import { ShortcutHelp } from './components/ShortcutHelp'
import { conversationMarkdown, sectionTitles, slug, solutionCode } from './answer'
import { useSolve } from './hooks/useSolve'
import { IS_MAC, prettyAccelerator, useKeyMap, type KeyMap } from './keyboard'

const TYPE_ORDER: ProblemType[] = ['dsa', 'lld', 'hld', 'db']
const SHORT_LABEL: Record<ProblemType, string> = { dsa: 'DSA', lld: 'LLD', hld: 'System Design', db: 'Database' }
const MOD = IS_MAC ? '⌘' : 'Ctrl'
const OPACITY_STEP = 0.08

export function App() {
  const [settings, setSettings] = useState<PublicSettings | null>(null)
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [context, setContext] = useState<ContextItem[]>([])
  const [dialog, setDialog] = useState<'settings' | 'help' | 'diagram' | null>(null)
  const [diagrams, setDiagrams] = useState<{ svgs: string[]; start: number }>({ svgs: [], start: 0 })
  const [toast, setToast] = useState<{ message: string; tone: 'info' | 'error' } | null>(null)
  /** Type picked before the first question; `undefined` follows settings. */
  const [typeOverride, setTypeOverride] = useState<ProblemType | undefined>()
  /** Index of the numbered section currently at the top of the answer. */
  const [activeSection, setActiveSection] = useState(0)
  const { state, ask, cancel, reset } = useSolve()
  // The section bar numbers the newest answer that has sections (a short follow-up may have none).
  let navTurn = -1
  let sections: string[] = []
  for (let i = state.turns.length - 1; i >= 0 && navTurn === -1; i--) {
    const titles = sectionTitles(state.turns[i].answer)
    if (titles.length >= 2) [navTurn, sections] = [i, titles]
  }
  const conversation = useRef<HTMLElement>(null)
  const prompt = useRef<HTMLTextAreaElement>(null)
  /** Follow the stream only while the user hasn't scrolled away from the bottom. */
  const stickToBottom = useRef(true)
  /** Context already sent in this conversation; follow-ups attach only what was added since. */
  const sentContext = useRef(new Set<string>())
  /** The section a number key jumped to, and where that left the scroll; the last sections can't reach the top. */
  const lastJump = useRef({ section: -1, scrollTop: -1 })

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
  }, [lastAnswerLength])
  // A new question scrolls to its own top, so a long answer is read from the start.
  useEffect(() => {
    const el = conversation.current
    const turn = el?.querySelector<HTMLElement>('.turn:last-of-type')
    if (el && turn) el.scrollTop = turn.offsetTop - el.offsetTop
  }, [state.turns.length])

  const flash = (message: string, tone: 'info' | 'error' = 'info', ms = 1600): void => {
    const next = { message, tone }
    setToast(next)
    setTimeout(() => setToast((t) => (t === next ? null : t)), ms)
  }

  const saveSettings = useCallback(async (patch: SettingsPatch) => {
    setSettings(await api.settings.update(patch))
  }, [])

  const submit = (text: string): void => {
    if (!text.trim() && context.length === 0) {
      flash('Type a prompt or capture some context first')
      return
    }
    stickToBottom.current = false
    const fresh = context.filter((c) => !sentContext.current.has(c.id)).map((c) => c.id)
    fresh.forEach((id) => sentContext.current.add(id))
    const first = state.turns.length === 0
    // Hand the keyboard to the answer, so number keys jump between its sections.
    conversation.current?.focus()
    void ask(text, { problemType: first ? typeOverride : undefined, contextIds: first ? undefined : fresh })
  }

  const newProblem = (): void => {
    reset()
    sentContext.current.clear()
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

  /** Scrolls to the next (1) or previous (-1) `##` section of the conversation. */
  const jumpSection = (direction: 1 | -1): void => {
    const el = conversation.current
    if (!el) return
    const top = el.getBoundingClientRect().top + navHeight()
    const offsets = [...el.querySelectorAll<HTMLElement>('.turn h2')].map((h) => h.getBoundingClientRect().top - top)
    const target = direction === 1 ? offsets.find((o) => o > 8) : offsets.filter((o) => o < -8).at(-1)
    if (target !== undefined) el.scrollTop += target - 4
  }

  /** Height of the sticky section bar, which covers the top of the scrolled answer. */
  const navHeight = (): number => conversation.current?.querySelector<HTMLElement>('.sections')?.offsetHeight ?? 0

  /** Headings of the answer the section bar numbers. */
  const sectionHeadings = (): HTMLElement[] => {
    const turn = conversation.current?.querySelectorAll<HTMLElement>('.turn')[navTurn]
    return [...(turn?.querySelectorAll<HTMLElement>('.markdown h2') ?? [])]
  }

  /** Scrolls section `n` (1-based) of the numbered answer to the top; 0 goes to its question. */
  const jumpTo = (n: number): void => {
    const el = conversation.current
    const target = n === 0 ? el?.querySelectorAll<HTMLElement>('.turn')[navTurn] : sectionHeadings()[n - 1]
    if (!el || !target) return
    stickToBottom.current = false
    el.scrollTop += target.getBoundingClientRect().top - el.getBoundingClientRect().top - navHeight() - 6
    lastJump.current = { section: Math.max(0, n - 1), scrollTop: el.scrollTop }
    setActiveSection(lastJump.current.section)
  }

  const updateActiveSection = (): void => {
    const el = conversation.current
    if (!el) return
    if (Math.abs(el.scrollTop - lastJump.current.scrollTop) < 2) return setActiveSection(lastJump.current.section)
    const line = el.getBoundingClientRect().top + navHeight() + 12
    const passed = sectionHeadings().filter((h) => h.getBoundingClientRect().top <= line).length
    setActiveSection(Math.max(0, passed - 1))
  }

  /** Opens the diagram viewer on the first diagram in view (else the last one). */
  const openDiagrams = (): void => {
    const el = conversation.current
    const svgs = [...(el?.querySelectorAll<SVGSVGElement>('.mermaid svg') ?? [])]
    if (!el || svgs.length === 0) return flash('No diagram to open yet')
    const view = el.getBoundingClientRect()
    const visible = svgs.findIndex((s) => {
      const r = s.getBoundingClientRect()
      return r.bottom > view.top && r.top < view.bottom
    })
    setDiagrams({ svgs: svgs.map((s) => s.outerHTML), start: visible === -1 ? svgs.length - 1 : visible })
    setDialog('diagram')
  }

  const exportMarkdown = (): void => {
    if (!state.turns.some((t) => t.answer)) return flash('Nothing to save yet')
    const label = state.detection ? PROBLEM_TYPE_LABELS[state.detection.type] : 'Answer'
    void api.ui
      .saveFile(`${slug(state.turns[0].prompt)}.md`, conversationMarkdown(state.turns, label))
      .then((path) => path && flash('Saved'))
  }

  const changeOpacity = (delta: number): void => {
    if (!settings) return
    const next = Math.round((settings.overlay.backgroundOpacity + delta) * 100) / 100
    void saveSettings({ overlay: { backgroundOpacity: next } })
  }

  const changeZoom = (delta: number | null): void => {
    if (!settings) return
    const next = delta === null ? 1 : Math.round((settings.overlay.zoom + delta) * 100) / 100
    void saveSettings({ overlay: { zoom: next } })
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
    } else if (command.type === 'notice') {
      flash(command.message, command.tone, command.tone === 'error' ? 12000 : 3500)
    } else {
      scroll(command.direction)
    }
  }
  useEffect(() => api.ui.onCommand((c) => onCommand.current(c)), [])

  const keyMap: KeyMap = {
    Escape: () => {
      if (state.busy) cancel()
      // Leaving the prompt lets number keys jump between sections; a second Esc hides.
      else if (document.activeElement === prompt.current && state.turns.length > 0) conversation.current?.focus()
      else void api.ui.hideWindow()
    },
    'CommandOrControl+L': () => prompt.current?.focus(),
    'CommandOrControl+N': newProblem,
    'CommandOrControl+,': () => setDialog('settings'),
    'CommandOrControl+/': () => setDialog('help'),
    F1: () => setDialog('help'),
    'CommandOrControl+Shift+C': () => {
      const code = solutionCode(lastAnswer, state.detection?.type)
      if (!code) return flash('No code block to copy yet')
      void navigator.clipboard.writeText(code).then(() => flash('Copied the code'))
    },
    'CommandOrControl+Shift+X': () => void api.context.clear(),
    'CommandOrControl+D': openDiagrams,
    'CommandOrControl+J': () => jumpSection(1),
    'CommandOrControl+Shift+J': () => jumpSection(-1),
    'CommandOrControl+S': exportMarkdown,
    'CommandOrControl+I': () => {
      const next = !settings?.interviewStepMode
      void saveSettings({ interviewStepMode: next }).then(() =>
        flash(next ? 'Interview step mode on: Alt + N for the next section' : 'Interview step mode off')
      )
    },
    'CommandOrControl+Shift+Backspace': () => {
      const newest = context.at(-1)
      if (newest) void api.context.remove(newest.id)
    },
    'CommandOrControl+[': () => changeOpacity(-OPACITY_STEP),
    'CommandOrControl+]': () => changeOpacity(OPACITY_STEP),
    'CommandOrControl+-': () => changeZoom(-0.1),
    'CommandOrControl+=': () => changeZoom(0.1),
    'CommandOrControl+Shift+=': () => changeZoom(0.1),
    'CommandOrControl+0': () => changeZoom(null),
    PageUp: () => scroll('up'),
    PageDown: () => scroll('down'),
    'Alt+Up': () => scroll('up'),
    'Alt+Down': () => scroll('down')
  }
  // Bare digits jump to numbered sections; they are ignored while the prompt box has focus.
  for (let n = 0; n <= Math.min(9, sections.length); n++) keyMap[String(n)] = () => jumpTo(n)
  TYPE_ORDER.forEach((t, i) => (keyMap[`CommandOrControl+${i + 1}`] = () => switchType(t)))
  const answerType = state.detection?.type ?? typeOverride ?? 'dsa'
  if (isFollowUp && !state.busy) {
    FOLLOW_UPS[answerType].forEach(({ prompt }, i) => (keyMap[`Alt+${i + 1}`] = () => submit(prompt)))
    if (settings?.interviewStepMode) keyMap['Alt+N'] = () => submit(NEXT_SECTION_PROMPT)
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
            {settings.interviewStepMode ? ' · step mode' : ''}
          </span>
          <span className="hint">
            <kbd>{MOD} + ,</kbd> settings · <kbd>{MOD} + /</kbd> keys · <kbd>Esc</kbd> hide
          </span>
        </div>
      </header>

      <div className="body">
        <ContextPanel
          items={context}
          clipboardShortcut={settings.shortcuts.captureClipboard}
          screenShortcut={settings.shortcuts.captureScreen}
        />

        <main
          className="conversation"
          ref={conversation}
          tabIndex={-1}
          onScroll={(e) => {
            const el = e.currentTarget
            stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
            if (sections.length > 0) updateActiveSection()
          }}
        >
          {sections.length > 0 && (
            <nav className="sections" aria-label="Sections">
              {sections.slice(0, 9).map((title, i) => (
                <button
                  key={`${i}-${title}`}
                  type="button"
                  tabIndex={-1}
                  className={i === activeSection ? 'active' : ''}
                  onClick={() => jumpTo(i + 1)}
                >
                  <kbd>{i + 1}</kbd> {title}
                </button>
              ))}
            </nav>
          )}
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
                here, <kbd>{prettyAccelerator(settings.shortcuts.captureScreen)}</kbd> to screenshot the screen,
                or <kbd>{prettyAccelerator(settings.shortcuts.captureClipboard)}</kbd> to capture the clipboard,
                then <kbd>{prettyAccelerator(settings.shortcuts.solveContext)}</kbd> to solve it.
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

      {toast && (
        <div className={`toast toast--${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
          {toast.message}
        </div>
      )}

      {dialog === 'settings' && (
        <SettingsDialog
          settings={settings}
          providers={providers}
          onSave={saveSettings}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'diagram' && (
        <DiagramViewer svgs={diagrams.svgs} start={diagrams.start} onClose={() => setDialog(null)} />
      )}
      {dialog === 'help' && <ShortcutHelp shortcuts={settings.shortcuts} onClose={() => setDialog(null)} />}
    </div>
  )
}
