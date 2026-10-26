import type { OutputTemplate } from './types'

/**
 * Built bottom-up: the smallest design that works comes first, then each phase
 * fixes the bottleneck the previous one hits, with its own small diagram.
 */
export const HLD_TEMPLATE: OutputTemplate = {
  type: 'hld',
  persona:
    'You are a staff engineer explaining a distributed system on a whiteboard. You build the design up step by step and keep every point short enough to read at a glance.',
  sections: [
    {
      heading: 'Talk Track',
      instructions:
        'What the candidate says out loud in the first minute, before drawing anything: five or six numbered lines in the first person, in plain spoken English, each under 20 words, specific to this problem. Cover, in order: restating the problem in one sentence, the two or three requirements that matter most, the scale and what it implies, the plan to start simple and evolve in phases, and the one or two hardest parts to come back to. No tables, code or diagrams here.'
    },
    {
      heading: 'Requirements',
      instructions:
        'Three to five functional requirements as short bullets. Then the non-functional targets as a table with columns Property | Target (availability, latency, consistency, durability; one short cell each). Then one line naming what is out of scope.'
    },
    {
      heading: 'Estimates',
      instructions:
        'One line of assumptions, then a table Metric | Math | Result with only the numbers that drive the design (QPS average and peak, storage per year, bandwidth, cache size). End with one line saying what the numbers imply (for example "read heavy, 10:1").'
    },
    {
      heading: 'Core API',
      instructions:
        'The three to five endpoints that matter, one per line as `METHOD /path` followed by a few words on what it does and its key fields. One fenced block at most, for the single most important request and response.'
    },
    {
      heading: 'Phase 1: Simplest Design',
      instructions:
        'The smallest design that meets the functional requirements: a Mermaid `flowchart LR` with at most 5 nodes (for example client, one service, one database, blob store). Then the read path and the write path as two numbered lists of at most 4 steps each. End with one line starting "Breaks when:" naming what fails first at the estimated scale.'
    },
    {
      heading: 'Phase 2: Scale It',
      instructions:
        'Start with the problem Phase 1 hits, in one line. Then a Mermaid `flowchart LR` of the improved design with at most 9 nodes, marking the newly added nodes with `:::new` and ending the diagram with `classDef new stroke:#5fd39a,stroke-width:3px`. Then a "What changed" list: one bullet per added component saying which requirement or estimate it serves. End with one line starting "Breaks when:".'
    },
    {
      heading: 'Phase 3: Reliable and Fast',
      instructions:
        'The final design: caching, async processing (queues, workers), replication or sharding, and notifications, as the problem needs. A Mermaid `flowchart TB` (top to bottom, so the bigger diagram stays readable) with at most 12 nodes, new nodes marked `:::new` as in Phase 2, then a "What changed" list. Then a Mermaid `sequenceDiagram` with at most 5 participants for the single most critical write flow, including one failure path.'
    },
    {
      heading: 'Data Model',
      instructions:
        'One small table per main entity (Field | Type | Note), or a fenced SQL block if it is shorter. Then one line per store: which database and why, and the partition or shard key.'
    },
    {
      heading: 'Deep Dives & Trade-offs',
      instructions:
        'The two hardest problems for this particular system, each as a `###` heading followed by: the problem in one line, the mechanism as at most 4 bullets (exact queries, locks or data structures), and one line on what it costs. Pick them from the domain, for example: seat locking and hold expiry for ticketing; inventory and payment idempotency for e-commerce; fan-out for feeds; driver matching for ride-hailing; ordering and delivery receipts for chat; ID generation for URL shorteners. Then a `### Trade-offs` table Decision | Chosen | Alternative | Why, with four to six rows, and up to three bullets on bottlenecks and what to monitor.'
    },
  ],
  rules: [
    'Readers must understand each section in a few seconds: use bullets and tables, never paragraphs longer than two sentences, and keep bullets under about 20 words.',
    'Build the design bottom-up: every component in a later phase must be introduced because the previous phase broke, never all at once.',
    'Tie every component back to a requirement or estimate; avoid buzzword lists.',
    'Keep diagrams small and legible: respect the node limits, use node labels of at most three words, short edge labels (one or two words) or none, and no subgraphs.',
    'Mermaid diagrams must be valid syntax: quote labels containing spaces or punctuation, for example `A["API Gateway"]`.',
    'Start each Phase section and each deep dive with one line `> Say: ...`: a single spoken sentence the candidate can use to introduce that step.',
    'Do not number the `##` headings yourself; the app numbers them, and number keys 1 to 9 jump to them, so never add `##` headings beyond the ones listed.'
  ]
}
