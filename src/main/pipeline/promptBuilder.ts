import type { ChatMessage, ContentPart, ContextItem, ProblemType } from '../../shared/types'
import { TEMPLATES } from './templates'

export interface SystemPromptOptions {
  preferredLanguage: string
}

export function buildSystemPrompt(type: ProblemType, options: SystemPromptOptions): string {
  const template = TEMPLATES[type]
  const sections = template.sections
    .map((s, i) => `${i + 1}. ## ${s.heading}\n   ${s.instructions}`)
    .join('\n')
  const rules = [
    `Write code in ${options.preferredLanguage} unless the problem or the user asks for another language.`,
    ...template.rules,
    'Format everything as GitHub-flavoured Markdown. Use the exact `##` headings below, in order.',
    'Context snippets may come from screenshots, the clipboard or speech transcription and can contain OCR or transcription noise; infer the intended problem.',
    'For follow-up messages, answer only what changed (for example a space-optimised version or extra edge cases), reusing the same headings where they apply, instead of repeating the whole answer.'
  ]
    .map((r) => `- ${r}`)
    .join('\n')

  return `${template.persona}

# Output structure
${sections}

# Rules
${rules}`
}

const SOURCE_LABELS: Record<ContextItem['source'], string> = {
  typed: 'typed note',
  clipboard: 'clipboard',
  paste: 'pasted',
  file: 'file',
  screen: 'screen capture',
  audio: 'voice transcript'
}

/** Turns the prompt plus attached context into one provider-neutral user message. */
export function buildUserMessage(prompt: string, context: ContextItem[]): ChatMessage {
  const content: ContentPart[] = []
  let snippet = 0
  for (const item of context) {
    if (item.kind === 'image') {
      content.push({ type: 'image', data: item.data, mediaType: item.mediaType })
    } else {
      snippet += 1
      content.push({
        type: 'text',
        text: `<context index="${snippet}" source="${SOURCE_LABELS[item.source]}">\n${item.text}\n</context>`
      })
    }
  }
  const trimmed = prompt.trim()
  content.push({
    type: 'text',
    text: trimmed || 'Solve the problem described in the attached context.'
  })
  return { role: 'user', content }
}

/** Text used for problem-type detection: the prompt plus all textual context. */
export function detectionText(prompt: string, context: ContextItem[]): string {
  return [prompt, ...context.flatMap((c) => (c.kind === 'text' ? [c.text] : []))].join('\n\n')
}
