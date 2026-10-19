import { useEffect, useState } from 'react'
import type {
  ConnectionTestResult,
  ProblemType,
  ProviderId,
  ProviderInfo,
  PublicSettings,
  SettingsPatch,
  ShortcutSettings
} from '../../../shared/types'
import { PROBLEM_TYPE_LABELS, SHORTCUT_LABELS } from '../../../shared/types'
import { api } from '../api'
import { eventAccelerator } from '../keyboard'
import { ShortcutInput } from './ShortcutInput'
import { useDialogKeys } from './useDialogKeys'

interface Props {
  settings: PublicSettings
  providers: ProviderInfo[]
  onSave(patch: SettingsPatch): Promise<void>
  onClose(): void
}

const LANGUAGES = ['Java', 'Python', 'C++', 'JavaScript', 'TypeScript', 'Go', 'Kotlin', 'C#', 'Rust']
/** Not wired up yet, so not editable. */
const HIDDEN_SHORTCUTS: (keyof ShortcutSettings)[] = ['toggleRecording']

/** Fully keyboard-operable: Tab between fields, Ctrl/⌘+Enter saves, Esc cancels. */
export function SettingsDialog({ settings, providers, onSave, onClose }: Props) {
  const ref = useDialogKeys<HTMLDivElement>(onClose)
  const [activeProvider, setActiveProvider] = useState<ProviderId>(settings.activeProvider)
  const [model, setModel] = useState(settings.providers[settings.activeProvider].model)
  const [baseUrl, setBaseUrl] = useState(settings.providers[settings.activeProvider].baseUrl ?? '')
  const [apiKey, setApiKey] = useState('')
  const [language, setLanguage] = useState(settings.preferredLanguage)
  const [mode, setMode] = useState<PublicSettings['problemTypeMode']>(settings.problemTypeMode)
  const [llmFallback, setLlmFallback] = useState(settings.llmDetectionFallback)
  const [opacity, setOpacity] = useState(settings.overlay.backgroundOpacity)
  const [alwaysOnTop, setAlwaysOnTop] = useState(settings.overlay.alwaysOnTop)
  const [shortcuts, setShortcuts] = useState<ShortcutSettings>(settings.shortcuts)
  const [failed, setFailed] = useState<string[]>([])
  const [test, setTest] = useState<ConnectionTestResult | 'running' | null>(null)

  const info = providers.find((p) => p.id === activeProvider)
  const stored = settings.providers[activeProvider]

  useEffect(() => {
    void api.ui.failedShortcuts().then(setFailed)
  }, [settings])

  useEffect(() => {
    setModel(settings.providers[activeProvider].model)
    setBaseUrl(settings.providers[activeProvider].baseUrl ?? '')
    setApiKey('')
    setTest(null)
  }, [activeProvider, settings])

  const patch = (): SettingsPatch => ({
    activeProvider,
    preferredLanguage: language,
    problemTypeMode: mode,
    llmDetectionFallback: llmFallback,
    overlay: { backgroundOpacity: opacity, alwaysOnTop },
    shortcuts,
    providers: {
      [activeProvider]: { model, baseUrl, ...(apiKey ? { apiKey } : {}) }
    }
  })

  const save = async (): Promise<void> => {
    await onSave(patch())
    onClose()
  }

  const runTest = async (): Promise<void> => {
    setTest('running')
    await onSave(patch())
    setApiKey('')
    setTest(await api.providers.test(activeProvider))
  }

  return (
    <div className="dialog__backdrop">
      <div
        className="dialog"
        role="dialog"
        aria-label="Settings"
        ref={ref}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (eventAccelerator(e) === 'CommandOrControl+Enter') {
            e.preventDefault()
            void save()
          }
        }}
      >
        <h2>Settings</h2>

        <fieldset>
          <legend>Model provider</legend>
          <label>
            Provider
            <select value={activeProvider} onChange={(e) => setActiveProvider(e.target.value as ProviderId)}>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Model
            <input list="model-suggestions" value={model} onChange={(e) => setModel(e.target.value)} />
            <datalist id="model-suggestions">
              {info?.suggestedModels.map((m) => <option key={m} value={m} />)}
            </datalist>
          </label>

          {info?.requiresApiKey && (
            <label>
              API key {stored.hasApiKey && <span className="ok">(saved; leave empty to keep, type to replace)</span>}
              <input
                type="password"
                value={apiKey}
                placeholder={stored.hasApiKey ? '••••••••' : 'Paste your API key'}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </label>
          )}

          {activeProvider === 'claudecode' ? (
            <>
              <p className="muted small">
                Uses your Claude subscription through Claude Code, so no API key is needed. Install it once with{' '}
                <code>curl -fsSL https://claude.ai/install.sh | bash</code>, then run <code>claude</code> in Terminal and
                sign in.
              </p>
              <label>
                Claude Code path (optional)
                <input value={baseUrl} placeholder="Found automatically" onChange={(e) => setBaseUrl(e.target.value)} />
              </label>
            </>
          ) : (
            <label>
              Base URL
              <input value={baseUrl} placeholder={info?.defaultBaseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
            </label>
          )}

          <div className="row">
            <button type="button" className="secondary" disabled={test === 'running'} onClick={() => void runTest()}>
              {test === 'running' ? 'Testing…' : 'Test connection'}
            </button>
            {stored.hasApiKey && (
              <button
                type="button"
                className="secondary"
                onClick={() => void onSave({ providers: { [activeProvider]: { apiKey: '' } } })}
              >
                Remove saved key
              </button>
            )}
            {test && test !== 'running' && <span className={test.ok ? 'ok' : 'err'}>{test.message}</span>}
          </div>
        </fieldset>

        <fieldset>
          <legend>Answers</legend>
          <label>
            Code language
            <input list="languages" value={language} onChange={(e) => setLanguage(e.target.value)} />
            <datalist id="languages">
              {LANGUAGES.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </label>
          <label>
            Problem type
            <select value={mode} onChange={(e) => setMode(e.target.value as PublicSettings['problemTypeMode'])}>
              <option value="auto">Auto-detect</option>
              {(Object.keys(PROBLEM_TYPE_LABELS) as ProblemType[]).map((t) => (
                <option key={t} value={t}>
                  Always {PROBLEM_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={llmFallback} onChange={(e) => setLlmFallback(e.target.checked)} />
            Ask the model to classify when keyword detection is unsure
          </label>
        </fieldset>

        <fieldset>
          <legend>Overlay</legend>
          <label>
            Background opacity: {Math.round(opacity * 100)}% (arrow keys adjust)
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.04}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
            />
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={alwaysOnTop} onChange={(e) => setAlwaysOnTop(e.target.checked)} />
            Keep the overlay above other windows
          </label>
        </fieldset>

        <fieldset>
          <legend>Global shortcuts (focus a field and press the new keys)</legend>
          {(Object.keys(SHORTCUT_LABELS) as (keyof ShortcutSettings)[])
            .filter((k) => !HIDDEN_SHORTCUTS.includes(k))
            .map((k) => (
              <div className="shortcut-row" key={k}>
                <label htmlFor={`sc-${k}`}>{SHORTCUT_LABELS[k]}</label>
                <ShortcutInput
                  id={`sc-${k}`}
                  value={shortcuts[k]}
                  modifiersOnly={k === 'moveWindowModifier'}
                  onChange={(v) => setShortcuts((s) => ({ ...s, [k]: v }))}
                />
                {failed.includes(settings.shortcuts[k]) && (
                  <span className="err small">Taken by another app</span>
                )}
              </div>
            ))}
        </fieldset>

        <div className="dialog__actions">
          <span className="hint">Tab to move · Ctrl/⌘ + Enter to save · Esc to cancel</span>
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={() => void save()}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
