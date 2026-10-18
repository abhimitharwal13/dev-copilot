import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { type DevCopilotApi, IPC } from '../shared/ipc'
import type { ContextItem, SolveEvent, UiCommand } from '../shared/types'

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const wrapped = (_event: IpcRendererEvent, payload: T): void => listener(payload)
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.removeListener(channel, wrapped)
}

const api: DevCopilotApi = {
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    update: (patch) => ipcRenderer.invoke(IPC.settingsUpdate, patch)
  },
  providers: {
    list: () => ipcRenderer.invoke(IPC.providersList),
    test: (id) => ipcRenderer.invoke(IPC.providersTest, id)
  },
  context: {
    list: () => ipcRenderer.invoke(IPC.contextList),
    addText: (text, source) => ipcRenderer.invoke(IPC.contextAddText, text, source),
    addImage: (dataUrl, source) => ipcRenderer.invoke(IPC.contextAddImage, dataUrl, source),
    remove: (id) => ipcRenderer.invoke(IPC.contextRemove, id),
    clear: () => ipcRenderer.invoke(IPC.contextClear),
    onChanged: (listener) => subscribe<ContextItem[]>(IPC.contextChanged, listener)
  },
  solve: {
    start: (request) => ipcRenderer.invoke(IPC.solveStart, request),
    cancel: (requestId) => ipcRenderer.invoke(IPC.solveCancel, requestId),
    onEvent: (listener) => subscribe<SolveEvent>(IPC.solveEvent, listener),
    resetConversation: (id) => ipcRenderer.invoke(IPC.conversationReset, id)
  },
  ui: {
    onCommand: (listener) => subscribe<UiCommand>(IPC.uiCommand, listener),
    hideWindow: () => ipcRenderer.invoke(IPC.windowHide),
    failedShortcuts: () => ipcRenderer.invoke(IPC.shortcutsFailed)
  }
}

contextBridge.exposeInMainWorld('devCopilot', api)
