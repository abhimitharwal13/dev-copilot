import { writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { app, dialog, ipcMain, type BrowserWindow } from 'electron'
import { IPC } from '../../shared/ipc'
import type { ContextSource, ProviderId, SettingsPatch, SolveRequest } from '../../shared/types'
import type { ContextBuffer } from '../inputs/ContextBuffer'
import type { SolvePipeline } from '../pipeline/pipeline'
import { createProvider, listProviders, PROVIDER_IDS } from '../providers/registry'
import type { SettingsStore } from '../settings/SettingsStore'

export interface HandlerDeps {
  settings: SettingsStore
  buffer: ContextBuffer
  pipeline: SolvePipeline
  getWindow(): BrowserWindow | null
}

export function registerIpcHandlers({ settings, buffer, pipeline, getWindow }: HandlerDeps): void {
  ipcMain.handle(IPC.settingsGet, () => settings.getPublic())
  ipcMain.handle(IPC.settingsUpdate, (_e, patch: SettingsPatch) => {
    settings.update(patch)
    return settings.getPublic()
  })

  ipcMain.handle(IPC.providersList, () => listProviders())
  ipcMain.handle(IPC.providersTest, (_e, id: ProviderId) => {
    if (!PROVIDER_IDS.includes(id)) return { ok: false, message: `Unknown provider: ${id}` }
    return createProvider(id, settings.get().providers[id]).testConnection()
  })

  ipcMain.handle(IPC.contextList, () => buffer.list())
  ipcMain.handle(IPC.contextAddText, (_e, text: string, source?: ContextSource) => buffer.addText(text, source))
  ipcMain.handle(IPC.contextAddImage, (_e, dataUrl: string, source?: ContextSource) =>
    buffer.addImageDataUrl(dataUrl, source)
  )
  ipcMain.handle(IPC.contextRemove, (_e, id: string) => buffer.remove(id))
  ipcMain.handle(IPC.contextClear, () => buffer.clear())
  buffer.onChange((items) => getWindow()?.webContents.send(IPC.contextChanged, items))

  ipcMain.handle(IPC.solveStart, (_e, request: SolveRequest) => pipeline.start(request))
  ipcMain.handle(IPC.solveCancel, (_e, requestId: string) => pipeline.cancel(requestId))
  ipcMain.handle(IPC.conversationReset, (_e, conversationId: string) => pipeline.reset(conversationId))
  ipcMain.handle(IPC.windowHide, () => getWindow()?.hide())
  ipcMain.handle(IPC.fileSave, async (_e, defaultName: string, content: string) => {
    const win = getWindow()
    const ext = extname(defaultName).slice(1)
    const options = {
      defaultPath: join(app.getPath('documents'), defaultName),
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
    }
    const { canceled, filePath } = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
    if (canceled || !filePath) return null
    await writeFile(filePath, content, 'utf8')
    return filePath
  })
}
