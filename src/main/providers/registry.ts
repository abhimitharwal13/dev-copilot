import type { ProviderConfig, ProviderId, ProviderInfo } from '../../shared/types'
import { ANTHROPIC_INFO, AnthropicProvider } from './anthropic'
import type { LLMProvider } from './LLMProvider'
import { OpenAICompatibleProvider } from './openaiCompatible'

const OPENAI_INFO: ProviderInfo = {
  id: 'openai',
  label: 'OpenAI',
  requiresApiKey: true,
  supportsImages: true,
  defaultModel: 'gpt-5',
  suggestedModels: ['gpt-5', 'gpt-5-mini', 'gpt-4.1'],
  defaultBaseUrl: 'https://api.openai.com/v1'
}

const GROQ_INFO: ProviderInfo = {
  id: 'groq',
  label: 'Groq',
  requiresApiKey: true,
  supportsImages: true,
  defaultModel: 'openai/gpt-oss-120b',
  suggestedModels: ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'meta-llama/llama-4-scout-17b-16e-instruct'],
  defaultBaseUrl: 'https://api.groq.com/openai/v1'
}

const OLLAMA_INFO: ProviderInfo = {
  id: 'ollama',
  label: 'Ollama (local)',
  requiresApiKey: false,
  supportsImages: true,
  defaultModel: 'qwen2.5-coder:14b',
  suggestedModels: ['qwen2.5-coder:14b', 'llama3.1:8b', 'llama3.2-vision:11b'],
  defaultBaseUrl: 'http://localhost:11434/v1'
}

type Factory = (config: ProviderConfig) => LLMProvider

interface ProviderEntry {
  info: ProviderInfo
  create: Factory
}

/**
 * Adding a vendor means adding one entry here (and its id to `ProviderId`).
 * Nothing else in the app knows which vendors exist.
 */
const REGISTRY: Record<ProviderId, ProviderEntry> = {
  anthropic: { info: ANTHROPIC_INFO, create: (c) => new AnthropicProvider(c) },
  openai: {
    info: OPENAI_INFO,
    create: (c) =>
      new OpenAICompatibleProvider(OPENAI_INFO, c, {
        maxTokensField: 'max_completion_tokens',
        sendTemperature: false,
        requestUsage: true
      })
  },
  groq: {
    info: GROQ_INFO,
    create: (c) =>
      new OpenAICompatibleProvider(GROQ_INFO, c, {
        maxTokensField: 'max_completion_tokens',
        sendTemperature: true,
        requestUsage: false
      })
  },
  ollama: {
    info: OLLAMA_INFO,
    create: (c) =>
      new OpenAICompatibleProvider(OLLAMA_INFO, c, {
        maxTokensField: 'max_tokens',
        sendTemperature: true,
        requestUsage: true
      })
  }
}

export const PROVIDER_IDS = Object.keys(REGISTRY) as ProviderId[]

export function listProviders(): ProviderInfo[] {
  return PROVIDER_IDS.map((id) => REGISTRY[id].info)
}

export function getProviderInfo(id: ProviderId): ProviderInfo {
  return REGISTRY[id].info
}

export function createProvider(id: ProviderId, config: ProviderConfig): LLMProvider {
  const entry = REGISTRY[id]
  if (!entry) throw new Error(`Unknown provider: ${id}`)
  return entry.create(config)
}
