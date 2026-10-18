import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type {
  ProviderConfig,
  ProviderId,
  PublicSettings,
  Settings,
  SettingsPatch
} from '../../shared/types'
import { PROVIDER_IDS } from '../providers/registry'
import { defaultSettings } from './defaults'

/** Encrypts API keys at rest. In the app this wraps Electron's `safeStorage`. */
export interface SecretCodec {
  encrypt(plain: string): string
  decrypt(encoded: string): string
}

/** Bumped when a default changes in a way existing files should pick up; see `migrate`. */
const SCHEMA_VERSION = 2

/** On-disk shape: identical to `Settings` except keys are encrypted. */
interface StoredSettings extends Omit<Settings, 'providers'> {
  schemaVersion?: number
  providers: Record<ProviderId, Omit<ProviderConfig, 'apiKey'> & { encryptedApiKey?: string }>
}

type Listener = (settings: Settings) => void

export class SettingsStore {
  private settings: Settings
  private readonly listeners = new Set<Listener>()

  constructor(
    private readonly filePath: string,
    private readonly codec: SecretCodec
  ) {
    this.settings = this.load()
  }

  get(): Settings {
    return this.settings
  }

  /** Settings with every API key replaced by `hasApiKey`. Safe to send to the renderer. */
  getPublic(): PublicSettings {
    const providers = Object.fromEntries(
      PROVIDER_IDS.map((id) => {
        const { apiKey, ...rest } = this.settings.providers[id]
        return [id, { ...rest, hasApiKey: Boolean(apiKey) }]
      })
    ) as PublicSettings['providers']
    return { ...this.settings, providers }
  }

  update(patch: SettingsPatch): Settings {
    const next: Settings = {
      ...this.settings,
      ...stripUndefined(patch),
      providers: { ...this.settings.providers },
      shortcuts: { ...this.settings.shortcuts, ...stripUndefined(patch.shortcuts ?? {}) },
      overlay: { ...this.settings.overlay, ...stripUndefined(patch.overlay ?? {}) }
    }
    next.overlay.backgroundOpacity = clamp(next.overlay.backgroundOpacity, 0.2, 1)
    for (const [id, change] of Object.entries(patch.providers ?? {}) as [ProviderId, Partial<ProviderConfig>][]) {
      if (!PROVIDER_IDS.includes(id) || !change) continue
      const merged = { ...next.providers[id], ...stripUndefined(change) }
      if (change.apiKey === '') delete merged.apiKey
      next.providers[id] = merged
    }
    if (!PROVIDER_IDS.includes(next.activeProvider)) next.activeProvider = this.settings.activeProvider
    this.settings = next
    this.save()
    for (const listener of this.listeners) listener(next)
    return next
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private load(): Settings {
    const defaults = defaultSettings()
    let stored: Partial<StoredSettings>
    try {
      stored = JSON.parse(readFileSync(this.filePath, 'utf8')) as Partial<StoredSettings>
    } catch {
      return defaults
    }
    const providers = { ...defaults.providers }
    for (const id of PROVIDER_IDS) {
      const { encryptedApiKey, ...rest } = stored.providers?.[id] ?? {}
      providers[id] = { ...defaults.providers[id], ...rest }
      if (encryptedApiKey) {
        try {
          providers[id].apiKey = this.codec.decrypt(encryptedApiKey)
        } catch {
          // Key was encrypted on another machine or profile; the user re-enters it.
        }
      }
    }
    const { schemaVersion = 1, ...rest } = stored
    return migrate(
      {
        ...defaults,
        ...rest,
        providers,
        shortcuts: { ...defaults.shortcuts, ...stored.shortcuts },
        overlay: { ...defaults.overlay, ...stored.overlay }
      },
      schemaVersion
    )
  }

  private save(): void {
    const providers = Object.fromEntries(
      PROVIDER_IDS.map((id) => {
        const { apiKey, ...rest } = this.settings.providers[id]
        return [id, apiKey ? { ...rest, encryptedApiKey: this.codec.encrypt(apiKey) } : rest]
      })
    )
    const stored = { schemaVersion: SCHEMA_VERSION, ...this.settings, providers } as StoredSettings
    mkdirSync(dirname(this.filePath), { recursive: true })
    const tmp = `${this.filePath}.tmp`
    writeFileSync(tmp, JSON.stringify(stored, null, 2), { mode: 0o600 })
    renameSync(tmp, this.filePath)
  }
}

/** Upgrades settings written by older versions. */
function migrate(settings: Settings, fromVersion: number): Settings {
  // v1 wrote the old Python default into every file; Java is the default from v2.
  if (fromVersion < 2 && settings.preferredLanguage === 'Python') return { ...settings, preferredLanguage: 'Java' }
  return settings
}

function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : max
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>
}
