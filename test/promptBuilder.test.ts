import { describe, expect, it } from 'vitest'
import { buildSystemPrompt, buildUserMessage, detectionText } from '../src/main/pipeline/promptBuilder'
import { TEMPLATES } from '../src/main/pipeline/templates'
import type { ContextItem } from '../src/shared/types'

const text = (t: string, source: ContextItem['source'] = 'clipboard'): ContextItem => ({
  id: t,
  kind: 'text',
  source,
  text: t,
  createdAt: 0
})

describe('buildSystemPrompt', () => {
  it.each(['dsa', 'lld', 'hld'] as const)('includes every %s section heading in order', (type) => {
    const prompt = buildSystemPrompt(type, { preferredLanguage: 'Java' })
    const positions = TEMPLATES[type].sections.map((s) => prompt.indexOf(`## ${s.heading}`))
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    expect(prompt).toContain('Write code in Java')
  })

  it('asks for Mermaid diagrams in design templates only', () => {
    expect(buildSystemPrompt('lld', { preferredLanguage: 'Python' })).toContain('classDiagram')
    expect(buildSystemPrompt('hld', { preferredLanguage: 'Python' })).toContain('flowchart')
    expect(buildSystemPrompt('dsa', { preferredLanguage: 'Python' })).not.toContain('mermaid')
  })
})

describe('buildUserMessage', () => {
  it('wraps text context with its source and puts the prompt last', () => {
    const msg = buildUserMessage('solve it', [text('snippet one'), text('heard this', 'audio')])
    expect(msg.role).toBe('user')
    expect(msg.content).toHaveLength(3)
    expect(msg.content[0]).toMatchObject({ type: 'text', text: expect.stringContaining('source="clipboard"') })
    expect(msg.content[1]).toMatchObject({ type: 'text', text: expect.stringContaining('source="voice transcript"') })
    expect(msg.content[2]).toEqual({ type: 'text', text: 'solve it' })
  })

  it('passes images through and supplies a default prompt', () => {
    const image: ContextItem = { id: 'i', kind: 'image', source: 'screen', data: 'AAAA', mediaType: 'image/png', createdAt: 0 }
    const msg = buildUserMessage('  ', [image])
    expect(msg.content[0]).toEqual({ type: 'image', data: 'AAAA', mediaType: 'image/png' })
    expect(msg.content[1]).toMatchObject({ type: 'text', text: expect.stringContaining('attached context') })
  })
})

describe('detectionText', () => {
  it('joins prompt and text context, ignoring images', () => {
    expect(detectionText('a', [text('b')])).toBe('a\n\nb')
  })
})
