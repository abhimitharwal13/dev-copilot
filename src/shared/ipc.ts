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
import type { Rect } from './region'

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
  windowMove: 'window:move',
  fileSave: 'file:save',
  shortcutsFailed: 'shortcuts:failed',
  captureImage: 'capture:image',
  captureDone: 'capture:done'
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
    moveWindow(direction: 'Left' | 'Right' | 'Up' | 'Down'): Promise<void>
    /** Opens a save dialog and writes the file; resolves to the path, or null when cancelled. */
    saveFile(defaultName: string, content: string): Promise<string | null>
    /** Global shortcuts that could not be registered, usually because another app owns them. */
    failedShortcuts(): Promise<string[]>
  }
  /** Used only by the screen region picker window. */
  capture: {
    /** The frozen screenshot to select from, as a data URL. */
    image(): Promise<string | null>
    /** Reports the selection in screen points, or null to cancel. */
    done(rect: Rect | null): void
  }
}
