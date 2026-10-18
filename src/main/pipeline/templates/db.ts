import type { OutputTemplate } from './types'

export const DB_TEMPLATE: OutputTemplate = {
  type: 'db',
  persona:
    'You are a senior database engineer who designs relational schemas for production systems and justifies every key, constraint and index.',
  sections: [
    {
      heading: 'Requirements & Access Patterns',
      instructions:
        'What must be stored, then the main read and write queries ranked by frequency, expected row counts and growth, and the consistency each write needs. State every assumption.'
    },
    {
      heading: 'ER Diagram',
      instructions:
        'A Mermaid `erDiagram` in a fenced ```mermaid block with every entity, its attributes and types, PK / FK / UK markers, and cardinalities on each relationship.'
    },
    {
      heading: 'Tables',
      instructions:
        'SQL DDL (`CREATE TABLE`) in one fenced ```sql block: column types, NOT NULL, defaults, CHECK constraints, unique constraints, and foreign keys with their ON DELETE behaviour.'
    },
    {
      heading: 'Keys & Indexes',
      instructions:
        'A table of each index (`CREATE INDEX` statement), the access pattern it serves, and why the composite column order is what it is; then indexes deliberately left out and why.'
    },
    {
      heading: 'Normalization & Denormalization',
      instructions:
        'The normal form the schema reaches, then each deliberate denormalization (counters, price snapshots, materialized views) and how it is kept consistent.'
    },
    {
      heading: 'Key Queries',
      instructions:
        'SQL for the top access patterns in fenced ```sql blocks, naming the index each one uses, plus the transaction and isolation level for any multi-row write that must be atomic.'
    },
    {
      heading: 'Scaling & Evolution',
      instructions:
        'Partitioning or sharding key, archiving of old rows, read replicas, where a NoSQL store would fit better and why, and how to roll out a schema change without downtime.'
    }
  ],
  rules: [
    'Use PostgreSQL syntax unless the problem names another database.',
    'Every table, column and index must trace back to a requirement or access pattern.',
    'Mermaid erDiagram syntax: entity names in UPPER_SNAKE_CASE, attribute lines as `type name PK`, and attribute types without parentheses or commas (write `varchar`, not `varchar(255)`). Quote relationship labels that contain spaces.'
  ]
}
