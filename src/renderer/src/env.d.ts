/// <reference types="vite/client" />
import type { DevCopilotApi } from '../../shared/ipc'

declare global {
  interface Window {
    devCopilot: DevCopilotApi
  }
}
