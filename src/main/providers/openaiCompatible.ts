import type { ChatMessage, ConnectionTestResult, ProviderConfig, ProviderInfo } from '../../shared/types'
import { collectStream, type CompletionRequest, type LLMProvider, ProviderError, type StreamChunk } from './LLMProvider'
import { readSse } from './sse'

/** Per-vendor quirks of the OpenAI Chat Completions wire format. */
export interface OpenAICompatibleOptions {
  /** OpenAI's reasoning models only accept `max_completion_tokens`. */
  maxTokensField: 'max_tokens' | 'max_completion_tokens'
  /** Reasoning models reject non-default temperatures. */
  sendTemperature: boolean
  /** `stream_options.include_usage` is not supported everywhere. */
  requestUsage: boolean
}

type OpenAIContent =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | OpenAIContent[]
}

interface ChatCompletionChunk {
  choices?: { delta?: { content?: string | null } }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null
  error?: { message?: string }
}

export function toOpenAIMessages(system: string, messages: ChatMessage[]): OpenAIMessage[] {
  const out: OpenAIMessage[] = [{ role: 'system', content: system }]
  for (const m of messages) {
    const hasImage = m.content.some((p) => p.type === 'image')
    if (!hasImage) {
      out.push({ role: m.role, content: m.content.map((p) => (p.type === 'text' ? p.text : '')).join('\n\n') })
      continue
    }
    out.push({
      role: m.role,
      content: m.content.map((p): OpenAIContent =>
        p.type === 'text'
          ? { type: 'text', text: p.text }
          : { type: 'image_url', image_url: { url: `data:${p.mediaType};base64,${p.data}` } }
      )
    })
  }
  return out
}

/**
 * One implementation for every vendor speaking the OpenAI Chat Completions
 * protocol: OpenAI itself, Groq, and Ollama's `/v1` endpoint.
 */
export class OpenAICompatibleProvider implements LLMProvider {
  constructor(
    readonly info: ProviderInfo,
    private readonly config: ProviderConfig,
    private readonly options: OpenAICompatibleOptions,
    private readonly fetchImpl: typeof fetch = globalThis.fetch
  ) {}

  private get baseUrl(): string {
    return (this.config.baseUrl || this.info.defaultBaseUrl).replace(/\/+$/, '')
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (this.config.apiKey) headers.authorization = `Bearer ${this.config.apiKey}`
    return headers
  }

  async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    if (this.info.requiresApiKey && !this.config.apiKey) {
      throw new ProviderError(`No ${this.info.label} API key configured.`, this.info.id)
    }
    const body: Record<string, unknown> = {
      model: this.config.model || this.info.defaultModel,
      messages: toOpenAIMessages(request.system, request.messages),
      stream: true
    }
    if (request.maxTokens) body[this.options.maxTokensField] = request.maxTokens
    if (this.options.sendTemperature && request.temperature !== undefined) body.temperature = request.temperature
    if (this.options.requestUsage) body.stream_options = { include_usage: true }

    let response: Response
    try {
      response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: request.signal
      })
    } catch (error) {
      throw this.networkError(error)
    }
    if (!response.ok || !response.body) throw await this.httpError(response)

    for await (const event of readSse(response.body)) {
      if (event.data === '[DONE]') break
      const chunk = JSON.parse(event.data) as ChatCompletionChunk
      if (chunk.error) throw new ProviderError(chunk.error.message ?? 'Stream error', this.info.id)
      const text = chunk.choices?.[0]?.delta?.content
      if (text) yield { type: 'text', text }
      if (chunk.usage) {
        yield {
          type: 'usage',
          usage: { inputTokens: chunk.usage.prompt_tokens, outputTokens: chunk.usage.completion_tokens }
        }
      }
    }
  }

  complete(request: CompletionRequest): Promise<string> {
    return collectStream(this.stream(request))
  }

  async testConnection(): Promise<ConnectionTestResult> {
    if (this.info.requiresApiKey && !this.config.apiKey) return { ok: false, message: 'Add an API key first.' }
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/models`, { headers: this.headers() })
      if (!response.ok) return { ok: false, message: (await this.httpError(response)).message }
      const json = (await response.json()) as { data?: { id: string }[] }
      const ids = json.data?.map((m) => m.id) ?? []
      const model = this.config.model || this.info.defaultModel
      if (ids.length > 0 && !ids.includes(model)) {
        return { ok: false, message: `Connected, but model "${model}" is not available.` }
      }
      return { ok: true, message: `Connected. Model: ${model}` }
    } catch (error) {
      return { ok: false, message: this.networkError(error).message }
    }
  }

  private networkError(error: unknown): ProviderError {
    if (error instanceof Error && error.name === 'AbortError') {
      return new ProviderError('Request cancelled.', this.info.id)
    }
    const detail = error instanceof Error ? error.message : String(error)
    return new ProviderError(`Could not reach ${this.info.label} at ${this.baseUrl}: ${detail}`, this.info.id)
  }

  private async httpError(response: Response): Promise<ProviderError> {
    let detail = response.statusText
    try {
      const json = (await response.json()) as { error?: { message?: string } | string }
      detail = typeof json.error === 'string' ? json.error : (json.error?.message ?? detail)
    } catch {
      // Body was not JSON; keep the status text.
    }
    const prefix = response.status === 401 ? 'API key rejected' : `HTTP ${response.status}`
    return new ProviderError(`${this.info.label}: ${prefix}: ${detail}`, this.info.id, response.status)
  }
}
