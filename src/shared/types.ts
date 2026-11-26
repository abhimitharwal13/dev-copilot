/**
 * Types shared by the main process, preload bridge and renderer.
 * Nothing in this file may import Electron or Node APIs.
 */

export type ProblemType = 'dsa' | 'lld' | 'hld' | 'db'

export const PROBLEM_TYPE_LABELS: Record<ProblemType, string> = {
  dsa: 'Data Structures & Algorithms',
  lld: 'Low-Level Design',
  hld: 'System Design',
  db: 'Database Design'
}

/** The message the "next section" key (Alt+N) sends in interview step mode. */
export const NEXT_SECTION_PROMPT = 'Next section.'

/** `claudecode` answers through the local Claude Code CLI and the user's Claude subscription. */
export type ProviderId = 'claudecode' | 'anthropic' | 'openai' | 'groq' | 'ollama'

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

/** Where a context item came from. `audio` arrives in a later iteration. */
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
  /** Interview pacing: clarifying questions first, then one section per "next section". */
  interviewStepMode: boolean
  temperature: number
  maxTokens: number
  overlay: OverlaySettings
  shortcuts: ShortcutSettings
}

export interface OverlaySettings {
  /** Alpha of the window background, 0.5..1. Text always stays opaque. */
  backgroundOpacity: number
  alwaysOnTop: boolean
  /** Text and layout size, 0.6..1.5 (1 = 100%). */
  zoom: number
  /** Mouse clicks, scrolls and hovers go to the app behind; the overlay is driven by keyboard only. */
  clickThrough: boolean
}

/**
 * Global shortcuts: they work while another app has focus, so the overlay is
 * fully usable from the keyboard. Values are Electron accelerators; '' disables one.
 */
export interface ShortcutSettings {
  /** Shows the overlay with the prompt box focused, ready to type a message. */
  customPrompt: string
  /** Sends the context buffer to the model without typing anything. */
  solveContext: string
  /** Adds the clipboard (text or image) to the context buffer. */
  captureClipboard: string
  /** Screenshots the whole screen under the pointer into the buffer, with no picker. */
  captureScreen: string
  /** Freezes the screen and lets you select a region to add as an image. */
  captureRegion: string
  /** Push-to-talk transcription; wired up in a later iteration. */
  toggleRecording: string
  /** Show / hide the main window. */
  toggleWindow: string
  /** Minimize the overlay; pressed again (from any app), restore it. */
  minimizeWindow: string
  /** Clear the answer and all context to start a new problem, from any app. */
  newProblem: string
  /** Turn mouse click-through on or off. */
  toggleClickThrough: string
  scrollUp: string
  scrollDown: string
  /** Held with an arrow key to move the window, e.g. `CommandOrControl+Alt` + Left. */
  moveWindowModifier: string
}

export const SHORTCUT_LABELS: Record<keyof ShortcutSettings, string> = {
  customPrompt: 'Type a custom prompt',
  solveContext: 'Solve the captured context',
  captureClipboard: 'Capture clipboard',
  captureScreen: 'Screenshot the whole screen',
  captureRegion: 'Screenshot a region (pick it first)',
  toggleRecording: 'Voice input (coming soon)',
  toggleWindow: 'Show / hide overlay',
  minimizeWindow: 'Minimize / restore overlay',
  newProblem: 'New problem (clear answer and context)',
  toggleClickThrough: 'Mouse goes through the overlay (on / off)',
  scrollUp: 'Scroll answer up',
  scrollDown: 'Scroll answer down',
  moveWindowModifier: 'Move overlay (+ arrow keys)'
}

/** Commands main sends to the renderer, mostly in response to global shortcuts. */
export type UiCommand =
  | { type: 'focusPrompt' }
  | { type: 'solveContext' }
  | { type: 'newProblem' }
  | { type: 'scroll'; direction: 'up' | 'down' }
  /** A message to show briefly, e.g. after a screen capture or when permission is missing. */
  | { type: 'notice'; message: string; tone: 'info' | 'error' }

/** Settings as the renderer sees them: secrets replaced by flags. */
export interface PublicProviderConfig extends Omit<ProviderConfig, 'apiKey'> {
  hasApiKey: boolean
}
export interface PublicSettings extends Omit<Settings, 'providers'> {
  providers: Record<ProviderId, PublicProviderConfig>
}

/** Partial update from the renderer. `apiKey: ''` clears a stored key. */
export interface SettingsPatch extends Partial<Omit<Settings, 'providers' | 'shortcuts' | 'overlay'>> {
  providers?: Partial<Record<ProviderId, Partial<ProviderConfig>>>
  shortcuts?: Partial<ShortcutSettings>
  overlay?: Partial<OverlaySettings>
}

export interface DetectionResult {
  type: ProblemType
  /** 0..1 */
  confidence: number
  method: 'heuristic' | 'llm' | 'manual'
  scores: Record<ProblemType, number>
  /** Set when the problem is commonly asked as this other type too (for example BookMyShow as LLD or HLD). */
  alternative?: ProblemType
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
