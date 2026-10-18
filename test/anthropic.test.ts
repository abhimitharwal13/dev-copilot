import type Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it, vi } from 'vitest'
import { AnthropicProvider, toAnthropicMessages } from '../src/main/providers/anthropic'
import { collectStream } from '../src/main/providers/LLMProvider'

function fakeClient(stopReason = 'end_turn') {
  const stream = vi.fn(() => {
    const events = [
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'O(n) ' } },
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'time' } }
    ]
    return {
      async *[Symbol.asyncIterator]() {
        yield* events
      },
      finalMessage: async () => ({ stop_reason: stopReason, usage: { input_tokens: 3, output_tokens: 2 } })
    }
  })
  return { client: { beta: { messages: { stream } } } as unknown as Anthropic, stream }
}

const request = { system: 'sys', messages: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'q' }] }] }

describe('AnthropicProvider', () => {
  it('streams text and sends effort plus server-side fallbacks, no temperature', async () => {
    const { client, stream } = fakeClient()
    const provider = new AnthropicProvider({ model: 'claude-opus-5-5', apiKey: 'k' }, client)
    expect(await collectStream(provider.stream({ ...request, temperature: 0.5 }))).toBe('O(n) time')
    const [params] = stream.mock.calls[0] as unknown as [Record<string, unknown>]
    expect(params).toMatchObject({
      model: 'claude-opus-5-5',
      system: 'sys',
      output_config: { effort: 'high' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default'
    })
    expect(params).not.toHaveProperty('temperature')
  })

  it('turns a refusal into an error', async () => {
    const { client } = fakeClient('refusal')
    const provider = new AnthropicProvider({ model: 'claude-opus-5-5', apiKey: 'k' }, client)
    await expect(collectStream(provider.stream(request))).rejects.toThrow(/declined/)
  })

  it('requires an API key', async () => {
    const { client } = fakeClient()
    await expect(collectStream(new AnthropicProvider({ model: 'x' }, client).stream(request))).rejects.toThrow(/API key/)
  })
})

describe('toAnthropicMessages', () => {
  it('maps images to base64 image blocks', () => {
    const [msg] = toAnthropicMessages([{ role: 'user', content: [{ type: 'image', data: 'AAAA', mediaType: 'image/png' }] }])
    expect(msg.content).toEqual([{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } }])
  })
})
