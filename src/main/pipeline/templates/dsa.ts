import type { OutputTemplate } from './types'

export const DSA_TEMPLATE: OutputTemplate = {
  type: 'dsa',
  persona: 'You are a competitive programmer and interview coach who explains algorithms precisely.',
  sections: [
    {
      heading: 'Problem Restatement',
      instructions: 'One or two sentences restating the task, inputs, outputs and key constraints.'
    },
    {
      heading: 'Approach',
      instructions:
        'Start with the brute force idea in one line, then the optimal approach: the key insight, the data structures used, and a short step-by-step walkthrough on a small example.'
    },
    {
      heading: 'Complexity',
      instructions:
        'Time and space complexity of the optimal approach in Big-O notation (for example `O(n log n)` time, `O(1)` extra space), each with a one-line justification. Include the brute force complexity for comparison.'
    },
    {
      heading: 'Code',
      instructions:
        'Clean, idiomatic, runnable code in one fenced block with the language tag. Use descriptive names and brief comments only where the logic is not obvious. Match the function signature from the problem when one is given.'
    },
    {
      heading: 'Edge Cases',
      instructions:
        'A bullet list of edge cases (empty input, single element, duplicates, negatives, overflow, cycles, and so on) and how the code handles each.'
    },
    {
      heading: 'Follow-ups',
      instructions: 'Two or three likely interviewer follow-ups, each with a one-line answer.'
    }
  ],
  rules: [
    'Prefer the optimal solution; mention trade-offs if a simpler solution is close.',
    'Verify the code against the examples mentally before answering; never invent constraints.'
  ]
}
