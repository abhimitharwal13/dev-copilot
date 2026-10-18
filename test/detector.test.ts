import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { detectHeuristic, detectProblemType, parseClassification } from '../src/main/pipeline/detector'
import type { LLMProvider } from '../src/main/providers/LLMProvider'

const TWO_SUM = `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.
Example 1:
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Constraints:
2 <= nums.length <= 10^4`

const PARKING_LOT = `Design a parking lot system. Model the classes for levels, spots and vehicles.
Use appropriate design patterns and keep it extensible for new vehicle types.`

const URL_SHORTENER = `Design a URL shortener like TinyURL that handles 100 million users with low latency.
Discuss the database, caching, and how the system scales.`

describe('detectHeuristic', () => {
  it('detects a LeetCode-style problem as DSA', () => {
    const r = detectHeuristic(TWO_SUM)
    expect(r.type).toBe('dsa')
    expect(r.certain).toBe(true)
  })

  it('detects an OOP design prompt as LLD', () => {
    const r = detectHeuristic(PARKING_LOT)
    expect(r.type).toBe('lld')
    expect(r.certain).toBe(true)
  })

  it('detects a scale-heavy prompt as system design', () => {
    const r = detectHeuristic(URL_SHORTENER)
    expect(r.type).toBe('hld')
    expect(r.certain).toBe(true)
  })

  it.each([
    ['Find the longest substring without repeating characters using a sliding window', 'dsa'],
    ['Low-level design of an elevator system with the State pattern', 'lld'],
    ['System design for a chat app like WhatsApp: message queue, replication, sharding', 'hld'],
    ['Implement an LRU cache class with get and put in O(1)', 'dsa']
  ])('classifies %j as %s', (text, expected) => {
    expect(detectHeuristic(text).type).toBe(expected)
  })

  it('recognises a HackerRank statement copied from the page', () => {
    const text = readFileSync(new URL('./fixtures/hackerrank-ransom-note.txt', import.meta.url), 'utf8')
    expect(detectHeuristic(text)).toMatchObject({ type: 'dsa', certain: true })
  })

  it.each(['design book my show', 'Design BookMyShow', 'Design a movie ticket booking system like BookMyShow'])(
    'treats %j as system design with LLD as the alternative, and asks the model',
    (text) => {
      expect(detectHeuristic(text)).toMatchObject({ type: 'hld', alternative: 'lld', certain: false })
    }
  )

  it('lets a scale cue settle a dual product as system design', () => {
    const r = detectHeuristic('Design BookMyShow for 10 million users')
    expect(r).toMatchObject({ type: 'hld', certain: true })
    expect(r.alternative).toBeUndefined()
  })

  it('lets a classes cue settle a dual product as LLD', () => {
    const r = detectHeuristic('Design BookMyShow: model the classes and interfaces, using design patterns')
    expect(r).toMatchObject({ type: 'lld', certain: true })
    expect(r.alternative).toBeUndefined()
  })

  it.each(['design swiggy', 'Design a food delivery app'])('classifies the product prompt %j as system design', (text) => {
    expect(detectHeuristic(text)).toMatchObject({ type: 'hld', certain: true })
  })

  it('leans to system design for a bare "design X" with no other cue', () => {
    expect(detectHeuristic('design a coupon platform')).toMatchObject({ type: 'hld', certain: false })
  })

  it.each([
    'Design the database schema for an e-commerce site',
    'database design for instagram',
    'design a schema for a library management system',
    'design database for parking lot',
    'Draw the ER diagram for a hospital management system and normalize it to 3NF'
  ])('classifies %j as database design', (text) => {
    expect(detectHeuristic(text)).toMatchObject({ type: 'db', certain: true })
  })

  it('keeps a plain parking lot as LLD', () => {
    expect(detectHeuristic('design parking lot')).toMatchObject({ type: 'lld', certain: true })
  })

  it('defaults to DSA with zero confidence when there is no signal', () => {
    const r = detectHeuristic('hello there')
    expect(r).toMatchObject({ type: 'dsa', confidence: 0, certain: false })
  })
})

describe('parseClassification', () => {
  it('extracts the label from noisy replies', () => {
    expect(parseClassification('HLD')).toBe('hld')
    expect(parseClassification('db')).toBe('db')
    expect(parseClassification('The answer is: lld.')).toBe('lld')
    expect(parseClassification('not sure')).toBeUndefined()
  })
})

describe('detectProblemType', () => {
  const fakeProvider = (reply: string): LLMProvider =>
    ({ complete: vi.fn().mockResolvedValue(reply) }) as unknown as LLMProvider

  it('skips the model when the heuristic is certain', async () => {
    const provider = fakeProvider('hld')
    const r = await detectProblemType(TWO_SUM, { provider, llmFallback: true })
    expect(r).toMatchObject({ type: 'dsa', method: 'heuristic' })
    expect(provider.complete).not.toHaveBeenCalled()
  })

  it('asks the model when the heuristic is unsure', async () => {
    const provider = fakeProvider('lld')
    const r = await detectProblemType('Design a rate limiter', { provider, llmFallback: true })
    expect(r).toMatchObject({ type: 'lld', method: 'llm' })
  })

  it('keeps the LLD alternative when the model picks system design for BookMyShow', async () => {
    const r = await detectProblemType('Design BookMyShow', { provider: fakeProvider('hld'), llmFallback: true })
    expect(r).toMatchObject({ type: 'hld', method: 'llm', alternative: 'lld' })
  })

  it('falls back to the heuristic when the model call fails', async () => {
    const provider = { complete: vi.fn().mockRejectedValue(new Error('offline')) } as unknown as LLMProvider
    const r = await detectProblemType('Design a rate limiter', { provider, llmFallback: true })
    expect(r.method).toBe('heuristic')
  })

  it('always asks the model for image-only input', async () => {
    const provider = fakeProvider('dsa')
    const r = await detectProblemType('', {
      provider,
      llmFallback: true,
      images: [{ type: 'image', data: 'AAAA', mediaType: 'image/png' }]
    })
    expect(r.method).toBe('llm')
  })
})
