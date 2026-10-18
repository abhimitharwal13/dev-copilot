import type {
  ConnectionTestResult,
  ContextItem,
  ProviderId,
  ProviderInfo,
  PublicSettings,
  SettingsPatch,
  SolveEvent,
  SolveRequest,
  UiCommand
} from './types'

/** Every IPC channel name lives here so main and preload cannot drift apart. */
export const IPC = {
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  providersList: 'providers:list',
  providersTest: 'providers:test',
  contextList: 'context:list',
  contextAddText: 'context:add-text',
  contextAddImage: 'context:add-image',
  contextRemove: 'context:remove',
  contextClear: 'context:clear',
  contextChanged: 'context:changed',
  solveStart: 'solve:start',
  solveCancel: 'solve:cancel',
  solveEvent: 'solve:event',
  conversationReset: 'conversation:reset',
  uiCommand: 'ui:command',
  windowHide: 'window:hide',
  shortcutsFailed: 'shortcuts:failed'
} as const

/** The API the preload script exposes on `window.devCopilot`. */
export interface DevCopilotApi {
  settings: {
    get(): Promise<PublicSettings>
    update(patch: SettingsPatch): Promise<PublicSettings>
  }
  providers: {
    list(): Promise<ProviderInfo[]>
    test(id: ProviderId): Promise<ConnectionTestResult>
  }
  context: {
    list(): Promise<ContextItem[]>
    addText(text: string, source?: ContextItem['source']): Promise<ContextItem>
    addImage(dataUrl: string, source?: ContextItem['source']): Promise<ContextItem>
    remove(id: string): Promise<void>
    clear(): Promise<void>
    onChanged(listener: (items: ContextItem[]) => void): () => void
  }
  solve: {
    /** Progress for `request.requestId` arrives through `onEvent`. */
    start(request: SolveRequest): Promise<void>
    cancel(requestId: string): Promise<void>
    onEvent(listener: (event: SolveEvent) => void): () => void
    resetConversation(conversationId: string): Promise<void>
  }
  ui: {
    /** Commands triggered by global shortcuts while another app may have focus. */
    onCommand(listener: (command: UiCommand) => void): () => void
    hideWindow(): Promise<void>
    /** Global shortcuts that could not be registered, usually because another app owns them. */
    failedShortcuts(): Promise<string[]>
  }
}
