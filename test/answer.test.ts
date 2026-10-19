import { describe, expect, it } from 'vitest'
import { conversationMarkdown, sectionTitles, slug, solutionCode } from '../src/renderer/src/answer'

const LLD = `## Class Diagram
\`\`\`mermaid
classDiagram
\`\`\`

## Implementation
\`\`\`java
class Spot {}
\`\`\`

\`\`\`java
public class Main {}
\`\`\`

## Key Flows
\`\`\`text
not code
\`\`\`
`

describe('solutionCode', () => {
  it('joins every block of the LLD implementation section', () => {
    expect(solutionCode(LLD, 'lld')).toBe('class Spot {}\n\npublic class Main {}')
  })

  it('falls back to the last non-diagram block', () => {
    expect(solutionCode(LLD, 'hld')).toBe('not code')
  })
})

describe('export helpers', () => {
  it('writes the conversation as Markdown with follow-ups quoted', () => {
    const md = conversationMarkdown(
      [
        { prompt: 'design parking lot', answer: '## Requirements\nA' },
        { prompt: 'Make it thread-safe', answer: '## Concurrency\nB' }
      ],
      'Low-Level Design'
    )
    expect(md).toContain('# design parking lot')
    expect(md).toContain('> Make it thread-safe')
    expect(md).toContain('## Concurrency')
  })

  it('makes a file-safe slug', () => {
    expect(slug('Design BookMyShow!')).toBe('design-bookmyshow')
  })
})

describe('sectionTitles', () => {
  it('lists ## headings outside code fences, without the model\'s own numbers', () => {
    const md = '## 1. Requirements\ntext\n```sql\n## not a heading\n```\n### sub\n## Phase 1: Simplest Design\n## 3) Core API'
    expect(sectionTitles(md)).toEqual(['Requirements', 'Phase 1: Simplest Design', 'Core API'])
  })
})
