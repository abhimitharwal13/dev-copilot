import type { ChatMessage, ConnectionTestResult, ProviderInfo, TokenUsage } from '../../shared/types'

export interface CompletionRequest {
  system: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  /** Reasoning depth hint for providers that support it. */
  effort?: 'low' | 'medium' | 'high'
  signal?: AbortSignal
}

export type StreamChunk =
  | { type: 'text'; text: string }
  | { type: 'usage'; usage: TokenUsage }

/**
 * The single seam between the app and any model vendor.
 * Implementations must be stateless apart from their config so they can be
 * rebuilt whenever settings change.
 */
export interface LLMProvider {
  readonly info: ProviderInfo
  /** Streams the completion as text chunks. Throws `ProviderError` on failure. */
  stream(request: CompletionRequest): AsyncIterable<StreamChunk>
  /** Non-streaming convenience used for short calls such as classification. */
  complete(request: CompletionRequest): Promise<string>
  testConnection(): Promise<ConnectionTestResult>
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly providerId: string,
    readonly status?: number
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}

/** Shared `complete` implementation in terms of `stream`. */
export async function collectStream(stream: AsyncIterable<StreamChunk>): Promise<string> {
  let text = ''
  for await (const chunk of stream) {
    if (chunk.type === 'text') text += chunk.text
  }
  return text
}
