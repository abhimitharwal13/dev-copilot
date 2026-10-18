import { randomUUID } from 'node:crypto'
import type {
  ChatMessage,
  ContextItem,
  DetectionResult,
  ProblemType,
  Settings,
  SolveEvent,
  SolveRequest,
  TokenUsage
} from '../../shared/types'
import type { LLMProvider } from '../providers/LLMProvider'
import { detectProblemType } from './detector'
import { buildSystemPrompt, buildUserMessage, detectionText } from './promptBuilder'

type EventBody = SolveEvent extends infer E ? (E extends SolveEvent ? Omit<E, 'requestId'> : never) : never

interface Conversation {
  id: string
  problemType: ProblemType
  detection: DetectionResult
  messages: ChatMessage[]
}

export interface PipelineDeps {
  getSettings(): Settings
  getProvider(): LLMProvider
  getContext(ids?: string[]): ContextItem[]
  emit(event: SolveEvent): void
}

/**
 * Detect → build prompt → stream. Conversations are kept in memory so follow-ups
 * ("optimise space", "more edge cases") reuse the detected type and history.
 */
export class SolvePipeline {
  private readonly conversations = new Map<string, Conversation>()
  private readonly inFlight = new Map<string, AbortController>()

  constructor(private readonly deps: PipelineDeps) {}

  /** Starts a request in the background; progress is reported through `emit`. */
  start(request: SolveRequest): void {
    const { requestId } = request
    const controller = new AbortController()
    this.inFlight.set(requestId, controller)
    void this.run(request, controller.signal).finally(() => this.inFlight.delete(requestId))
  }

  cancel(requestId: string): void {
    this.inFlight.get(requestId)?.abort()
  }

  reset(conversationId: string): void {
    this.conversations.delete(conversationId)
  }

  /** Exposed for tests: runs a request to completion. */
  async run(request: SolveRequest, signal: AbortSignal): Promise<void> {
    const { requestId } = request
    const emit = (e: EventBody): void => this.deps.emit({ requestId, ...e } as SolveEvent)
    try {
      const settings = this.deps.getSettings()
      const provider = this.deps.getProvider()
      const existing = request.conversationId ? this.conversations.get(request.conversationId) : undefined
      const conversation = existing ?? (await this.createConversation(request, settings, provider, signal))
      emit({ type: 'started', conversationId: conversation.id })
      emit({ type: 'detected', detection: conversation.detection })

      // Follow-ups only attach context the user explicitly picked.
      const context =
        existing && !request.contextIds ? [] : this.deps.getContext(request.contextIds)
      const userMessage = buildUserMessage(request.prompt, context)
      const messages = [...conversation.messages, userMessage]

      let text = ''
      let usage: TokenUsage | undefined
      for await (const chunk of provider.stream({
        system: buildSystemPrompt(conversation.problemType, {
          preferredLanguage: settings.preferredLanguage,
          stepMode: settings.interviewStepMode
        }),
        messages,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        signal
      })) {
        if (signal.aborted) break
        if (chunk.type === 'text') {
          text += chunk.text
          emit({ type: 'delta', text: chunk.text })
        } else {
          usage = chunk.usage
        }
      }
      if (signal.aborted) throw new Error('Request cancelled.')

      conversation.messages = [...messages, { role: 'assistant', content: [{ type: 'text', text }] }]
      this.conversations.set(conversation.id, conversation)
      emit({ type: 'done', text, usage })
    } catch (error) {
      emit({ type: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  private async createConversation(
    request: SolveRequest,
    settings: Settings,
    provider: LLMProvider,
    signal: AbortSignal
  ): Promise<Conversation> {
    const forced = request.problemType ?? (settings.problemTypeMode === 'auto' ? undefined : settings.problemTypeMode)
    let detection: DetectionResult
    if (forced) {
      detection = { type: forced, confidence: 1, method: 'manual', scores: { dsa: 0, lld: 0, hld: 0, db: 0 } }
    } else {
      const context = this.deps.getContext(request.contextIds)
      detection = await detectProblemType(detectionText(request.prompt, context), {
        provider,
        llmFallback: settings.llmDetectionFallback,
        images: provider.info.supportsImages
          ? context.flatMap((c) => (c.kind === 'image' ? [{ type: 'image' as const, data: c.data, mediaType: c.mediaType }] : []))
          : [],
        signal
      })
    }
    return { id: request.conversationId ?? randomUUID(), problemType: detection.type, detection, messages: [] }
  }
}
