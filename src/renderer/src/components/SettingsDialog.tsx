import { useEffect, useState } from 'react'
import type {
  ConnectionTestResult,
  ProblemType,
  ProviderId,
  ProviderInfo,
  PublicSettings,
  SettingsPatch
} from '../../../shared/types'
import { PROBLEM_TYPE_LABELS } from '../../../shared/types'
import { api } from '../api'

interface Props {
  settings: PublicSettings
  providers: ProviderInfo[]
  onSave(patch: SettingsPatch): Promise<void>
  onClose(): void
}

export function SettingsDialog({ settings, providers, onSave, onClose }: Props) {
  const [activeProvider, setActiveProvider] = useState<ProviderId>(settings.activeProvider)
  const [model, setModel] = useState(settings.providers[settings.activeProvider].model)
  const [baseUrl, setBaseUrl] = useState(settings.providers[settings.activeProvider].baseUrl ?? '')
  const [apiKey, setApiKey] = useState('')
  const [language, setLanguage] = useState(settings.preferredLanguage)
  const [mode, setMode] = useState<PublicSettings['problemTypeMode']>(settings.problemTypeMode)
  const [llmFallback, setLlmFallback] = useState(settings.llmDetectionFallback)
  const [test, setTest] = useState<ConnectionTestResult | 'running' | null>(null)

  const info = providers.find((p) => p.id === activeProvider)
  const stored = settings.providers[activeProvider]

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
    <div className="dialog__backdrop" onClick={onClose}>
      <div className="dialog" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>

        <fieldset>
          <legend>Model provider</legend>
          <div className="segmented">
            {providers.map((p) => (
              <button
                key={p.id}
                type="button"
                className={p.id === activeProvider ? 'active' : ''}
                onClick={() => setActiveProvider(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <label>
            Model
            <input list="model-suggestions" value={model} onChange={(e) => setModel(e.target.value)} />
            <datalist id="model-suggestions">
              {info?.suggestedModels.map((m) => <option key={m} value={m} />)}
            </datalist>
          </label>

          {info?.requiresApiKey && (
            <label>
              API key
              <input
                type="password"
                value={apiKey}
                placeholder={stored.hasApiKey ? 'Saved. Type to replace.' : 'Paste your API key'}
                onChange={(e) => setApiKey(e.target.value)}
              />
              {stored.hasApiKey && (
                <button type="button" className="link" onClick={() => void onSave({ providers: { [activeProvider]: { apiKey: '' } } })}>
                  Remove saved key
                </button>
              )}
            </label>
          )}

          <label>
            Base URL
            <input value={baseUrl} placeholder={info?.defaultBaseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </label>

          <div className="row">
            <button type="button" className="secondary" disabled={test === 'running'} onClick={() => void runTest()}>
              {test === 'running' ? 'Testing…' : 'Test connection'}
            </button>
            {test && test !== 'running' && (
              <span className={test.ok ? 'ok' : 'err'}>{test.message}</span>
            )}
          </div>
        </fieldset>

        <fieldset>
          <legend>Answers</legend>
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
          <label>
            Preferred code language
            <input value={language} onChange={(e) => setLanguage(e.target.value)} />
          </label>
        </fieldset>

        <div className="dialog__actions">
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
