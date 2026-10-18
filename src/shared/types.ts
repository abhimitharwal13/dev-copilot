/**
 * Types shared by the main process, preload bridge and renderer.
 * Nothing in this file may import Electron or Node APIs.
 */

export type ProblemType = 'dsa' | 'lld' | 'hld'

export const PROBLEM_TYPE_LABELS: Record<ProblemType, string> = {
  dsa: 'Data Structures & Algorithms',
  lld: 'Low-Level Design',
  hld: 'System Design'
}

export type ProviderId = 'anthropic' | 'openai' | 'groq' | 'ollama'

/** One item in the context buffer. New input streams add a new `kind`. */
export type ContextItem =
  | { id: string; kind: 'text'; source: ContextSource; text: string; createdAt: number }
  | {
      id: string
      kind: 'image'
      source: ContextSource
      /** Base64 without the `data:` prefix. */
      data: string
      mediaType: 'image/png' | 'image/jpeg' | 'image/webp'
      createdAt: number
    }

/** Where a context item came from. `screen` and `audio` arrive in later iterations. */
export type ContextSource = 'typed' | 'clipboard' | 'paste' | 'file' | 'screen' | 'audio'

export type Role = 'user' | 'assistant'

/** Provider-neutral message content. */
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mediaType: string }

export interface ChatMessage {
  role: Role
  content: ContentPart[]
}

export interface ProviderConfig {
  model: string
  /** Stored encrypted at rest; only ever sent to the renderer as `hasApiKey`. */
  apiKey?: string
  baseUrl?: string
}

export interface Settings {
  activeProvider: ProviderId
  providers: Record<ProviderId, ProviderConfig>
  /** `auto` runs detection; anything else forces a template. */
  problemTypeMode: 'auto' | ProblemType
  /** Use the active model to classify when keyword heuristics are unsure. */
  llmDetectionFallback: boolean
  preferredLanguage: string
  temperature: number
  maxTokens: number
  shortcuts: ShortcutSettings
}

export interface ShortcutSettings {
  /** Adds the clipboard (text or image) to the context buffer. */
  captureClipboard: string
  /** Screen region capture; wired up in a later iteration. */
  captureScreen: string
  /** Push-to-talk transcription; wired up in a later iteration. */
  toggleRecording: string
  /** Show / hide the main window. */
  toggleWindow: string
}

/** Settings as the renderer sees them: secrets replaced by flags. */
export interface PublicProviderConfig extends Omit<ProviderConfig, 'apiKey'> {
  hasApiKey: boolean
}
export interface PublicSettings extends Omit<Settings, 'providers'> {
  providers: Record<ProviderId, PublicProviderConfig>
}

/** Partial update from the renderer. `apiKey: ''` clears a stored key. */
export interface SettingsPatch extends Partial<Omit<Settings, 'providers' | 'shortcuts'>> {
  providers?: Partial<Record<ProviderId, Partial<ProviderConfig>>>
  shortcuts?: Partial<ShortcutSettings>
}

export interface DetectionResult {
  type: ProblemType
  /** 0..1 */
  confidence: number
  method: 'heuristic' | 'llm' | 'manual'
  scores: Record<ProblemType, number>
}

export interface SolveRequest {
  /** Chosen by the caller so it can match events that arrive before `start` resolves. */
  requestId: string
  /** Conversation id; follow-ups reuse it. */
  conversationId?: string
  prompt: string
  /** Ids of buffer items to attach. Defaults to the whole buffer on the first turn. */
  contextIds?: string[]
  /** Overrides settings.problemTypeMode for this request. */
  problemType?: ProblemType
}

export type SolveEvent =
  | { requestId: string; type: 'started'; conversationId: string }
  | { requestId: string; type: 'detected'; detection: DetectionResult }
  | { requestId: string; type: 'delta'; text: string }
  | { requestId: string; type: 'done'; text: string; usage?: TokenUsage }
  | { requestId: string; type: 'error'; message: string }

export interface TokenUsage {
  inputTokens?: number
  outputTokens?: number
}

export interface ProviderInfo {
  id: ProviderId
  label: string
  requiresApiKey: boolean
  supportsImages: boolean
  defaultModel: string
  suggestedModels: string[]
  defaultBaseUrl: string
}

export interface ConnectionTestResult {
  ok: boolean
  message: string
}
