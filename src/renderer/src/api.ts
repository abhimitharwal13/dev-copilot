import type { DevCopilotApi } from '../../shared/ipc'

/** Typed handle to the preload bridge. The only way the renderer talks to main. */
export const api: DevCopilotApi = window.devCopilot
