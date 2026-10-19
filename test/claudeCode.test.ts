import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildArgs, childEnv, ClaudeCodeProvider, explain, findClaudeBinary, toStdinMessage } from '../src/main/providers/claudeCode'
import type { ChatMessage } from '../src/shared/types'

/** A stand-in `claude` binary: records its argv and stdin, then prints the given stream-json lines. */
function fakeCli(lines: object[], exitCode = 0): { path: string; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), 'fake-claude-'))
  const path = join(dir, 'claude')
  writeFileSync(
    path,
    `#!/usr/bin/env node
const fs = require('fs')
let input = ''
process.stdin.on('data', (d) => (input += d))
process.stdin.on('end', () => {
  fs.writeFileSync(${JSON.stringify(join(dir, 'call.json'))}, JSON.stringify({ argv: process.argv.slice(2), input, env: { key: process.env.ANTHROPIC_API_KEY ?? null } }))
  for (const line of ${JSON.stringify(lines.map((l) => JSON.stringify(l)))}) console.log(line)
  process.exit(${exitCode})
})
`
  )
  chmodSync(path, 0o755)
  return { path, dir }
}

const delta = (text: string) => ({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text } } })
const question: ChatMessage[] = [
  {
    role: 'user',
    content: [
      { type: 'image', data: 'AAAA', mediaType: 'image/png' },
      { type: 'text', text: 'Solve it' }
    ]
  }
]

describe('ClaudeCodeProvider', () => {
  it('streams text deltas from the CLI, sends the image, and hides API keys from it', async () => {
    const cli = fakeCli([
      { type: 'system', subtype: 'init' },
      delta('## Approach'),
      delta('\nUse a map.'),
      { type: 'result', subtype: 'success', is_error: false, result: '## Approach\nUse a map.', usage: { input_tokens: 12, output_tokens: 7 } }
    ])
    process.env.ANTHROPIC_API_KEY = 'sk-should-not-leak'
    const provider = new ClaudeCodeProvider({ model: 'sonnet', baseUrl: cli.path })
    const chunks = []
    for await (const c of provider.stream({ system: 'SYS', messages: question })) chunks.push(c)
    delete process.env.ANTHROPIC_API_KEY

    expect(chunks).toEqual([
      { type: 'text', text: '## Approach' },
      { type: 'text', text: '\nUse a map.' },
      { type: 'usage', usage: { inputTokens: 12, outputTokens: 7 } }
    ])
    const call = JSON.parse(readFileSync(join(cli.dir, 'call.json'), 'utf8'))
    expect(call.argv).toEqual(buildArgs('SYS', 'sonnet'))
    expect(call.env.key).toBeNull()
    const sent = JSON.parse(call.input)
    expect(sent.message.content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } })
  })

  it('falls back to the final result when the CLI does not stream partial messages', async () => {
    const cli = fakeCli([{ type: 'result', subtype: 'success', is_error: false, result: 'Whole answer' }])
    const text = await new ClaudeCodeProvider({ model: 'opus', baseUrl: cli.path }).complete({ system: 's', messages: question })
    expect(text).toBe('Whole answer')
  })

  it('turns a sign-in failure into a clear next step', async () => {
    const cli = fakeCli([{ type: 'result', subtype: 'success', is_error: true, result: 'Invalid API key · Please run /login' }], 1)
    const provider = new ClaudeCodeProvider({ model: 'opus', baseUrl: cli.path })
    await expect(provider.complete({ system: 's', messages: question })).rejects.toThrow(/not signed in/)
  })

  it('explains how to install Claude Code when the binary is missing', async () => {
    const provider = new ClaudeCodeProvider({ model: 'opus', baseUrl: '/nowhere/claude' })
    await expect(provider.complete({ system: 's', messages: question })).rejects.toThrow(/install\.sh/)
  })
})

describe('Claude Code helpers', () => {
  it('replays earlier turns as labelled text before the new message', () => {
    const line = toStdinMessage([
      ...question,
      { role: 'assistant', content: [{ type: 'text', text: 'Answer 1' }] },
      { role: 'user', content: [{ type: 'text', text: 'Optimise space' }] }
    ])
    const texts = JSON.parse(line).message.content.map((b: { type: string; text?: string }) => b.text ?? b.type)
    expect(texts).toEqual([
      '<Earlier question>',
      'image',
      'Solve it',
      '</Earlier question>',
      '<Your earlier answer>',
      'Answer 1',
      '</Your earlier answer>',
      'Now the new message:',
      'Optimise space'
    ])
  })

  it('finds the binary in the usual install locations', () => {
    const exists = (p: string) => p.endsWith('/.local/bin/claude')
    expect(findClaudeBinary(undefined, exists)).toMatch(/\.local\/bin\/claude$/)
    expect(findClaudeBinary(undefined, () => false)).toBeNull()
  })

  it('strips API credentials and adds install dirs to PATH', () => {
    const env = childEnv({ ANTHROPIC_API_KEY: 'k', ANTHROPIC_AUTH_TOKEN: 't', CLAUDE_CODE_OAUTH_TOKEN: 'o', PATH: '/usr/bin' })
    expect(env.ANTHROPIC_API_KEY).toBeUndefined()
    expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
    expect(env.CLAUDE_CODE_OAUTH_TOKEN).toBeUndefined()
    expect(env.PATH).toMatch(/\.local\/bin.*\/usr\/bin$/)
  })

  it('names the usage limit when the plan runs out', () => {
    expect(explain('Claude AI usage limit reached|1760000000')).toMatch(/plan's usage limit/)
  })
})
