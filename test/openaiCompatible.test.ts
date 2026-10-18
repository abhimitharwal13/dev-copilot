import { describe, expect, it, vi } from 'vitest'
import { collectStream } from '../src/main/providers/LLMProvider'
import { OpenAICompatibleProvider, toOpenAIMessages } from '../src/main/providers/openaiCompatible'
import { createProvider, listProviders } from '../src/main/providers/registry'

function sseResponse(lines: string[]): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      // Split mid-line to exercise buffering across chunks.
      const text = lines.map((l) => `data: ${l}\n\n`).join('')
      controller.enqueue(encoder.encode(text.slice(0, 17)))
      controller.enqueue(encoder.encode(text.slice(17)))
      controller.close()
    }
  })
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

const info = listProviders().find((p) => p.id === 'groq')!

describe('OpenAICompatibleProvider', () => {
  it('streams deltas and sends the configured fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([
        JSON.stringify({ choices: [{ delta: { content: 'Hel' } }] }),
        JSON.stringify({ choices: [{ delta: { content: 'lo' } }] }),
        '[DONE]'
      ])
    )
    const provider = new OpenAICompatibleProvider(
      info,
      { model: 'm', apiKey: 'k' },
      { maxTokensField: 'max_completion_tokens', sendTemperature: true, requestUsage: false },
      fetchMock
    )
    const text = await collectStream(
      provider.stream({ system: 'sys', messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }], maxTokens: 50, temperature: 0.1 })
    )
    expect(text).toBe('Hello')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions')
    expect(init.headers.authorization).toBe('Bearer k')
    expect(JSON.parse(init.body)).toMatchObject({ model: 'm', max_completion_tokens: 50, temperature: 0.1, stream: true })
  })

  it('surfaces HTTP errors with the vendor message', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'bad key' } }), { status: 401 })
    )
    const provider = new OpenAICompatibleProvider(info, { model: 'm', apiKey: 'k' }, { maxTokensField: 'max_tokens', sendTemperature: false, requestUsage: false }, fetchMock)
    await expect(collectStream(provider.stream({ system: '', messages: [] }))).rejects.toThrow(/API key rejected: bad key/)
  })

  it('refuses to call a keyed vendor without a key', async () => {
    const provider = createProvider('openai', { model: 'gpt-5' })
    await expect(collectStream(provider.stream({ system: '', messages: [] }))).rejects.toThrow(/No OpenAI API key/)
  })
})

describe('toOpenAIMessages', () => {
  it('flattens text-only turns and keeps images as data URLs', () => {
    const out = toOpenAIMessages('sys', [
      { role: 'user', content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] },
      { role: 'user', content: [{ type: 'image', data: 'AAAA', mediaType: 'image/png' }, { type: 'text', text: 'c' }] }
    ])
    expect(out[0]).toEqual({ role: 'system', content: 'sys' })
    expect(out[1]).toEqual({ role: 'user', content: 'a\n\nb' })
    expect(out[2].content).toEqual([
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } },
      { type: 'text', text: 'c' }
    ])
  })
})

describe('registry', () => {
  it('exposes all four providers', () => {
    expect(listProviders().map((p) => p.id)).toEqual(['anthropic', 'openai', 'groq', 'ollama'])
  })
})
