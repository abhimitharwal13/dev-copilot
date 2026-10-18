import { describe, expect, it } from 'vitest'
import { conversationMarkdown, slug, solutionCode } from '../src/renderer/src/answer'

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
