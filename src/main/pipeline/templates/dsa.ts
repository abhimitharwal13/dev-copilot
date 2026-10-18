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
        'Clean, idiomatic, runnable code in one fenced block with the language tag. Match the function signature from the problem when one is given. Comment the code for someone explaining it aloud in an interview: start the function with a comment block giving the approach in one line, `Time: O(...)` and `Space: O(...)`; mark each key step with a short comment that says why it works (the invariant, the trick, or the pitfall it avoids), prefixed `Hint:` where it is the core insight. Use the comment syntax of the code language. Do not comment obvious lines.'
    },
    {
      heading: 'Test Cases',
      instructions:
        'A table of test cases with columns Input, Expected and Why: the given samples first, then the edge cases that break naive solutions (empty or single element, duplicates, negatives, overflow, cycles, limits, worst-case size), saying in Why how the code handles each. Then a short dry run of the code on the trickiest case.'
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
