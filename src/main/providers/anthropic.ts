import Anthropic from '@anthropic-ai/sdk'
import type { ChatMessage, ConnectionTestResult, ProviderConfig, ProviderInfo } from '../../shared/types'
import { collectStream, type CompletionRequest, type LLMProvider, ProviderError, type StreamChunk } from './LLMProvider'

export const ANTHROPIC_INFO: ProviderInfo = {
  id: 'anthropic',
  label: 'Claude (Anthropic)',
  requiresApiKey: true,
  supportsImages: true,
  defaultModel: 'claude-opus-5-5',
  suggestedModels: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1'],
  defaultBaseUrl: 'https://api.anthropic.com'
}

type ImageMediaType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'

export function toAnthropicMessages(messages: ChatMessage[]): Anthropic.Beta.BetaMessageParam[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.content.map((part): Anthropic.Beta.BetaContentBlockParam =>
      part.type === 'text'
        ? { type: 'text', text: part.text }
        : {
            type: 'image',
            source: { type: 'base64', media_type: part.mediaType as ImageMediaType, data: part.data }
          }
    )
  }))
}

/**
 * Claude via the official SDK. Current models reject sampling parameters, so
 * `temperature` is ignored here; depth is controlled with `effort` instead.
 */
export class AnthropicProvider implements LLMProvider {
  readonly info = ANTHROPIC_INFO
  private readonly client: Anthropic

  constructor(
    private readonly config: ProviderConfig,
    client?: Anthropic
  ) {
    this.client =
      client ??
      new Anthropic({
        apiKey: config.apiKey,
        baseURL: config.baseUrl || undefined
      })
  }

  async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    if (!this.config.apiKey) throw new ProviderError('No Anthropic API key configured.', this.info.id)
    try {
      const stream = this.client.beta.messages.stream(
        {
          model: this.config.model || this.info.defaultModel,
          max_tokens: request.maxTokens ?? 64000,
          system: request.system,
          messages: toAnthropicMessages(request.messages),
          output_config: { effort: request.effort ?? 'high' },
          // Re-run on the server's default fallback model if a policy classifier declines.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default'
        },
        { signal: request.signal }
      )
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield { type: 'text', text: event.delta.text }
        }
      }
      const final = await stream.finalMessage()
      if (final.stop_reason === 'refusal') {
        throw new ProviderError('The model declined this request.', this.info.id)
      }
      yield {
        type: 'usage',
        usage: { inputTokens: final.usage.input_tokens, outputTokens: final.usage.output_tokens }
      }
    } catch (error) {
      throw toProviderError(error, this.info.id)
    }
  }

  complete(request: CompletionRequest): Promise<string> {
    return collectStream(this.stream(request))
  }

  async testConnection(): Promise<ConnectionTestResult> {
    if (!this.config.apiKey) return { ok: false, message: 'Add an API key first.' }
    try {
      const model = await this.client.models.retrieve(this.config.model || this.info.defaultModel)
      return { ok: true, message: `Connected. Model: ${model.display_name}` }
    } catch (error) {
      return { ok: false, message: toProviderError(error, this.info.id).message }
    }
  }
}

function toProviderError(error: unknown, providerId: string): ProviderError {
  if (error instanceof ProviderError) return error
  if (error instanceof Anthropic.AuthenticationError) {
    return new ProviderError('Anthropic rejected the API key.', providerId, error.status)
  }
  if (error instanceof Anthropic.NotFoundError) {
    return new ProviderError('Model not found. Check the model id in settings.', providerId, error.status)
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new ProviderError('Rate limited by Anthropic. Try again shortly.', providerId, error.status)
  }
  if (error instanceof Anthropic.APIUserAbortError) {
    return new ProviderError('Request cancelled.', providerId)
  }
  if (error instanceof Anthropic.APIError) {
    return new ProviderError(`Anthropic API error: ${error.message}`, providerId, error.status)
  }
  return new ProviderError(error instanceof Error ? error.message : String(error), providerId)
}
