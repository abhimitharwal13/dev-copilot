import { describe, expect, it } from 'vitest'
import { SolvePipeline } from '../src/main/pipeline/pipeline'
import type { CompletionRequest, LLMProvider, StreamChunk } from '../src/main/providers/LLMProvider'
import { defaultSettings } from '../src/main/settings/defaults'
import type { ContextItem, SolveEvent } from '../src/shared/types'

class FakeProvider implements LLMProvider {
  readonly info = {
    id: 'anthropic' as const,
    label: 'Fake',
    requiresApiKey: false,
    supportsImages: true,
    defaultModel: 'fake',
    suggestedModels: [],
    defaultBaseUrl: ''
  }
  readonly requests: CompletionRequest[] = []
  constructor(private readonly reply: string[]) {}
  async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    this.requests.push(request)
    for (const text of this.reply) yield { type: 'text', text }
    yield { type: 'usage', usage: { inputTokens: 10, outputTokens: 5 } }
  }
  async complete(): Promise<string> {
    return 'dsa'
  }
  async testConnection() {
    return { ok: true, message: '' }
  }
}

function setup(context: ContextItem[] = []) {
  const provider = new FakeProvider(['## Approach', '\nUse a hash map.'])
  const events: SolveEvent[] = []
  const pipeline = new SolvePipeline({
    getSettings: () => ({ ...defaultSettings(), llmDetectionFallback: false }),
    getProvider: () => provider,
    getContext: (ids) => (ids ? context.filter((c) => ids.includes(c.id)) : context),
    emit: (e) => events.push(e)
  })
  return { provider, events, pipeline }
}

const run = (pipeline: SolvePipeline, request: Parameters<SolvePipeline['run']>[0]) =>
  pipeline.run(request, new AbortController().signal)

describe('SolvePipeline', () => {
  it('detects, streams and finishes a first question', async () => {
    const { events, pipeline, provider } = setup()
    await run(pipeline, { requestId: 'r1', prompt: 'Given an array nums, return the two indices that sum to target' })

    expect(events.map((e) => e.type)).toEqual(['started', 'detected', 'delta', 'delta', 'done'])
    const detected = events.find((e) => e.type === 'detected')
    expect(detected).toMatchObject({ detection: { type: 'dsa', method: 'heuristic' } })
    expect(events.at(-1)).toMatchObject({ type: 'done', text: '## Approach\nUse a hash map.', usage: { outputTokens: 5 } })
    expect(provider.requests[0].system).toContain('## Complexity')
  })

  it('keeps history and the detected type for follow-ups', async () => {
    const { events, pipeline, provider } = setup()
    await run(pipeline, { requestId: 'r1', prompt: 'Design a parking lot with classes and design patterns' })
    const conversationId = (events[0] as Extract<SolveEvent, { type: 'started' }>).conversationId

    await run(pipeline, { requestId: 'r2', conversationId, prompt: 'Make it thread-safe' })
    const second = provider.requests[1]
    expect(second.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user'])
    expect(second.system).toContain('## Class Diagram')
    expect(events.filter((e) => e.requestId === 'r2' && e.type === 'started')).toEqual([
      { requestId: 'r2', type: 'started', conversationId }
    ])
  })

  it('attaches the context buffer on the first turn only', async () => {
    const ctx: ContextItem[] = [{ id: 'c1', kind: 'text', source: 'clipboard', text: 'int[] nums', createdAt: 0 }]
    const { events, pipeline, provider } = setup(ctx)
    await run(pipeline, { requestId: 'r1', prompt: 'solve' })
    const conversationId = (events[0] as Extract<SolveEvent, { type: 'started' }>).conversationId
    await run(pipeline, { requestId: 'r2', conversationId, prompt: 'optimise space' })

    expect(provider.requests[0].messages[0].content).toHaveLength(2)
    expect(provider.requests[1].messages[2].content).toHaveLength(1)
  })

  it('honours a forced problem type', async () => {
    const { events, pipeline, provider } = setup()
    await run(pipeline, { requestId: 'r1', prompt: 'Given an array nums...', problemType: 'hld' })
    expect(events[1]).toMatchObject({ detection: { type: 'hld', method: 'manual' } })
    expect(provider.requests[0].system).toContain('## Problems With the Basic Design')
  })

  it('reports provider failures as error events', async () => {
    const { events, pipeline } = setup()
    const failing = new SolvePipeline({
      getSettings: () => defaultSettings(),
      getProvider: () => {
        throw new Error('No API key')
      },
      getContext: () => [],
      emit: (e) => events.push(e)
    })
    await failing.run({ requestId: 'x', prompt: 'hi' }, new AbortController().signal)
    expect(events).toEqual([{ requestId: 'x', type: 'error', message: 'No API key' }])
    void pipeline
  })
})
