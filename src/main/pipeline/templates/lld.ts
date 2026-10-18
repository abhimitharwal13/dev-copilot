import type { OutputTemplate } from './types'

export const LLD_TEMPLATE: OutputTemplate = {
  type: 'lld',
  persona: 'You are a senior engineer who designs clean, extensible object-oriented components.',
  sections: [
    {
      heading: 'Requirements',
      instructions: 'Functional requirements as a bullet list, then assumptions you are making.'
    },
    {
      heading: 'Core Entities',
      instructions: 'The main classes, interfaces and enums, each with a one-line responsibility.'
    },
    {
      heading: 'Class Diagram',
      instructions:
        'A Mermaid `classDiagram` in a fenced ```mermaid block showing attributes, key methods, inheritance, composition and multiplicities.'
    },
    {
      heading: 'Design Patterns',
      instructions:
        'Each pattern used (Strategy, Factory, Observer, State, Singleton, ...), where it is applied, and why it fits. Mention how the design follows SOLID.'
    },
    {
      heading: 'Implementation',
      instructions:
        'A working implementation in one or more fenced code blocks, including a small driver or `main` that exercises the main flow and its edge cases. Keep it compilable. Comment each class with its responsibility and the pattern it plays a role in (for example `// Strategy: pricing varies by vehicle type`), and mark concurrency or extensibility decisions with `Hint:` comments.'
    },
    {
      heading: 'Key Flows',
      instructions:
        'A Mermaid `sequenceDiagram` for the most important interaction, followed by a short explanation.'
    },
    {
      heading: 'Concurrency & Extensibility',
      instructions:
        'Thread-safety concerns and how they are handled, and how the design accommodates likely new requirements.'
    }
  ],
  rules: [
    'Favour composition over inheritance and program to interfaces.',
    'Mermaid diagrams must be valid syntax: no HTML, no parentheses in node labels, generics written as `List~Item~`.'
  ]
}
