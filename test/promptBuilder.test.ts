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

  it('asks DSA answers for complexity and hint comments in code, plus test cases', () => {
    const prompt = buildSystemPrompt('dsa', { preferredLanguage: 'Java' })
    expect(prompt).toContain('`Time: O(...)` and `Space: O(...)`')
    expect(prompt).toContain('`Hint:`')
    expect(prompt).toContain('## Test Cases')
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

  it('tells the model that several screenshots are one problem in order', () => {
    const shot = (id: string): ContextItem => ({ id, kind: 'image', source: 'screen', data: id, mediaType: 'image/png', createdAt: 0 })
    const msg = buildUserMessage('solve', [shot('a'), shot('b')])
    expect(msg.content.map((p) => p.type)).toEqual(['image', 'image', 'text', 'text'])
    expect(msg.content[2]).toMatchObject({ type: 'text', text: expect.stringContaining('2 images above are screenshots in capture order') })
    expect(msg.content[3]).toEqual({ type: 'text', text: 'solve' })
  })
})

describe('detectionText', () => {
  it('joins prompt and text context, ignoring images', () => {
    expect(detectionText('a', [text('b')])).toBe('a\n\nb')
  })
})

describe('database design and step mode', () => {
  it('asks for an ER diagram and DDL for database design', () => {
    const prompt = buildSystemPrompt('db', { preferredLanguage: 'Java' })
    expect(prompt).toContain('erDiagram')
    expect(prompt).toContain('CREATE TABLE')
    expect(prompt).toContain('## Keys & Indexes')
  })

  it('adds pacing rules only in step mode', () => {
    expect(buildSystemPrompt('hld', { preferredLanguage: 'Java', stepMode: true })).toContain('## Clarifying Questions')
    expect(buildSystemPrompt('hld', { preferredLanguage: 'Java' })).not.toContain('step mode')
  })
})
