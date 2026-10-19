import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { createInterface } from 'node:readline'
import type { ChatMessage, ConnectionTestResult, ContentPart, ProviderConfig, ProviderInfo } from '../../shared/types'
import { collectStream, type CompletionRequest, type LLMProvider, ProviderError, type StreamChunk } from './LLMProvider'

export const CLAUDE_CODE_INFO: ProviderInfo = {
  id: 'claudecode',
  label: 'Claude (your subscription)',
  requiresApiKey: false,
  supportsImages: true,
  defaultModel: 'opus',
  suggestedModels: ['opus', 'sonnet', 'haiku'],
  // Repurposed: an optional path to the `claude` binary when it isn't in a usual place.
  defaultBaseUrl: ''
}

const INSTALL_HINT =
  'Claude Code is not installed. In Terminal run: curl -fsSL https://claude.ai/install.sh | bash, then run claude once and sign in with your Claude account.'
const LOGIN_HINT = 'Claude Code is not signed in. In Terminal run claude, sign in with your Claude account, then try again.'

/** Where installers put the CLI. Apps opened from Finder get a minimal PATH, so look explicitly. */
function candidatePaths(): string[] {
  const home = homedir()
  return [
    join(home, '.local', 'bin', 'claude'),
    join(home, '.claude', 'local', 'claude'),
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
    join(home, '.npm-global', 'bin', 'claude')
  ]
}

export function findClaudeBinary(configured?: string, exists: (p: string) => boolean = existsSync): string | null {
  if (configured?.trim()) return exists(configured.trim()) ? configured.trim() : null
  return candidatePaths().find(exists) ?? null
}

/** Arguments for one headless, tool-less answer that streams text as it is written. */
export function buildArgs(system: string, model: string): string[] {
  return [
    '-p',
    '--input-format',
    'stream-json',
    '--output-format',
    'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--system-prompt',
    system,
    '--model',
    model,
    // Answer only: no file, shell or MCP tools.
    '--tools',
    '',
    '--disallowedTools',
    'mcp__*',
    '--no-session-persistence',
    '--max-turns',
    '1'
  ]
}

/**
 * The CLI takes one user message per run, so earlier turns are replayed as
 * labelled text, with every image kept in place.
 */
export function toStdinMessage(messages: ChatMessage[]): string {
  const content: Array<Record<string, unknown>> = []
  const last = messages.length - 1
  messages.forEach((m, i) => {
    const label = i === last ? null : m.role === 'user' ? 'Earlier question' : 'Your earlier answer'
    if (label) content.push({ type: 'text', text: `[${label}]` })
    for (const part of m.content) content.push(toBlock(part))
    if (label) content.push({ type: 'text', text: `[End of ${label.toLowerCase()}]` })
  })
  if (last > 0) content.splice(content.length - messages[last].content.length, 0, { type: 'text', text: 'Now the new message:' })
  return `${JSON.stringify({ type: 'user', message: { role: 'user', content }, parent_tool_use_id: null })}\n`
}

function toBlock(part: ContentPart): Record<string, unknown> {
  return part.type === 'text'
    ? { type: 'text', text: part.text }
    : { type: 'image', source: { type: 'base64', media_type: part.mediaType, data: part.data } }
}

/** Environment for the CLI: drop API credentials so it uses the subscription login. */
export function childEnv(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = { ...base }
  delete env.ANTHROPIC_API_KEY
  delete env.ANTHROPIC_AUTH_TOKEN
  delete env.CLAUDE_CODE_OAUTH_TOKEN
  const extra = [join(homedir(), '.local', 'bin'), '/opt/homebrew/bin', '/usr/local/bin']
  env.PATH = [...extra, env.PATH ?? ''].filter(Boolean).join(delimiter)
  return env
}

interface CliEvent {
  type?: string
  subtype?: string
  is_error?: boolean
  result?: string
  usage?: { input_tokens?: number; output_tokens?: number }
  event?: { type?: string; delta?: { type?: string; text?: string } }
}

/**
 * Claude through the user's own Claude Code CLI and Claude subscription
 * login, so no API key is needed. The app never sees or stores credentials.
 */
export class ClaudeCodeProvider implements LLMProvider {
  readonly info = CLAUDE_CODE_INFO

  constructor(
    private readonly config: ProviderConfig,
    private readonly spawnFn: typeof spawn = spawn
  ) {}

  async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    const binary = findClaudeBinary(this.config.baseUrl)
    if (!binary) throw new ProviderError(INSTALL_HINT, this.info.id)
    if (request.signal?.aborted) throw new ProviderError('Request cancelled.', this.info.id)

    const child = this.spawnFn(binary, buildArgs(request.system, this.config.model || this.info.defaultModel), {
      cwd: tmpdir(),
      env: childEnv(process.env),
      stdio: ['pipe', 'pipe', 'pipe']
    })
    const abort = (): void => void child.kill()
    request.signal?.addEventListener('abort', abort, { once: true })
    let stderr = ''
    child.stderr?.on('data', (d: Buffer) => (stderr = (stderr + d.toString()).slice(-4000)))
    const exited = new Promise<number | null>((resolve, reject) => {
      child.on('error', reject)
      child.on('close', resolve)
    })
    exited.catch(() => {})
    child.stdin?.on('error', () => {})
    child.stdin?.end(toStdinMessage(request.messages))

    let streamed = false
    let final: CliEvent | null = null
    try {
      for await (const line of createInterface({ input: child.stdout! })) {
        if (!line.trim()) continue
        let event: CliEvent
        try {
          event = JSON.parse(line) as CliEvent
        } catch {
          continue
        }
        const delta = event.event?.delta
        if (event.type === 'stream_event' && delta?.type === 'text_delta' && delta.text) {
          streamed = true
          yield { type: 'text', text: delta.text }
        } else if (event.type === 'result') {
          final = event
        }
      }
      const code = await exited
      if (request.signal?.aborted) throw new ProviderError('Request cancelled.', this.info.id)
      if (!final || final.is_error || (final.subtype && final.subtype !== 'success')) {
        throw new ProviderError(explain(final?.result || stderr || `Claude Code exited with code ${code}.`), this.info.id)
      }
      // Older CLIs without partial messages only report the whole answer at the end.
      if (!streamed && final.result) yield { type: 'text', text: final.result }
      if (final.usage) {
        yield { type: 'usage', usage: { inputTokens: final.usage.input_tokens, outputTokens: final.usage.output_tokens } }
      }
    } catch (error) {
      if (error instanceof ProviderError) throw error
      const err = error as NodeJS.ErrnoException
      throw new ProviderError(err.code === 'ENOENT' ? INSTALL_HINT : explain(err.message ?? String(error)), this.info.id)
    } finally {
      request.signal?.removeEventListener('abort', abort)
      if (child.exitCode === null) child.kill()
    }
  }

  complete(request: CompletionRequest): Promise<string> {
    return collectStream(this.stream(request))
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const text = await this.complete({
        system: 'Reply with exactly: OK',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'ping' }] }]
      })
      return { ok: true, message: `Connected through Claude Code with your Claude account. Reply: ${text.trim().slice(0, 40)}` }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }
}

/** Turns CLI failures into something the user can act on. */
export function explain(message: string): string {
  if (/log ?in|logged in|authenticat|oauth|invalid api key|credential/i.test(message)) return LOGIN_HINT
  if (/usage limit|rate limit|limit reached/i.test(message)) {
    return `Your Claude plan's usage limit was reached. ${message.trim()}`
  }
  return message.trim()
}
