import type { ProviderId, Settings } from '../../shared/types'
import { getProviderInfo, PROVIDER_IDS } from '../providers/registry'

export function defaultSettings(): Settings {
  const providers = Object.fromEntries(
    PROVIDER_IDS.map((id) => [id, { model: getProviderInfo(id).defaultModel }])
  ) as Settings['providers']
  return {
    activeProvider: 'anthropic' satisfies ProviderId,
    providers,
    problemTypeMode: 'auto',
    llmDetectionFallback: true,
    preferredLanguage: 'Java',
    temperature: 0.2,
    maxTokens: 16000,
    overlay: { backgroundOpacity: 0.72, alwaysOnTop: true },
    shortcuts: {
      customPrompt: 'CommandOrControl+Shift+K',
      solveContext: 'CommandOrControl+Shift+Enter',
      captureClipboard: 'CommandOrControl+Shift+V',
      captureScreen: 'CommandOrControl+Shift+S',
      toggleRecording: 'CommandOrControl+Shift+R',
      toggleWindow: 'CommandOrControl+Shift+Space',
      scrollUp: 'CommandOrControl+Shift+Up',
      scrollDown: 'CommandOrControl+Shift+Down',
      moveWindowModifier: 'CommandOrControl+Alt'
    }
  }
}
