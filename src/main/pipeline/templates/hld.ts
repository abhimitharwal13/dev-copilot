import type { OutputTemplate } from './types'

export const HLD_TEMPLATE: OutputTemplate = {
  type: 'hld',
  persona: 'You are a staff engineer who designs large-scale distributed systems and explains trade-offs clearly.',
  sections: [
    {
      heading: 'Requirements',
      instructions:
        'Functional requirements, then non-functional requirements (availability, latency, consistency, durability), then what is explicitly out of scope.'
    },
    {
      heading: 'Capacity Estimation',
      instructions:
        'Back-of-the-envelope numbers: DAU, read/write QPS (average and peak), storage per year, bandwidth, and cache size. Show the arithmetic in a small table and state every assumption.'
    },
    {
      heading: 'API Contracts',
      instructions:
        'The core endpoints (REST or RPC) with method, path, request and response shapes, and status codes, in fenced code blocks.'
    },
    {
      heading: 'Data Model',
      instructions:
        'The main entities and their schema, the database choice for each (SQL or NoSQL) with justification, and indexing or partition keys.'
    },
    {
      heading: 'High-Level Architecture',
      instructions:
        'A Mermaid `flowchart LR` in a fenced ```mermaid block showing clients, load balancers, services, caches, queues and data stores, followed by a walkthrough of the main read and write paths.'
    },
    {
      heading: 'Deep Dives',
      instructions:
        'Two or three of the hardest components in depth (for example feed fan-out, ID generation, sharding strategy, or consistency model).'
    },
    {
      heading: 'Trade-offs & Bottlenecks',
      instructions:
        'A table of key decisions with the alternatives considered and why one was chosen, then bottlenecks, failure modes, and how to monitor and scale them.'
    }
  ],
  rules: [
    'Tie every component back to a requirement or estimate; avoid buzzword lists.',
    'Mermaid diagrams must be valid syntax: quote labels containing spaces or punctuation, for example `A["API Gateway"]`.'
  ]
}
