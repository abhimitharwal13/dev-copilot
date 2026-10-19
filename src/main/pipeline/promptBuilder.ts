import type { ChatMessage, ContentPart, ContextItem, ProblemType } from '../../shared/types'
import { NEXT_SECTION_PROMPT } from '../../shared/types'
import { TEMPLATES } from './templates'

export interface SystemPromptOptions {
  preferredLanguage: string
  /** Pace the answer like an interview: one section per turn. */
  stepMode?: boolean
}


const STEP_MODE_RULES = [
  'Interview step mode is on: pace the answer the way a live interview goes.',
  'In the first reply, start with `## Clarifying Questions`: up to five short questions the candidate should ask the interviewer, each with the assumption you will use if there is no answer. Then write only section 1 of the output structure.',
  `When the user says "${NEXT_SECTION_PROMPT}", write only the next section of the output structure that has not been written yet, using its exact heading.`,
  'End every step-mode reply with one line: `Next: <heading of the next section>`, or `Next: done` after the last section.'
]

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
    'For follow-up messages, answer only what changed (for example a space-optimised version or extra edge cases), reusing the same headings where they apply, instead of repeating the whole answer.',
    ...(options.stepMode ? STEP_MODE_RULES : [])
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
  const images = context.filter((c) => c.kind === 'image').length
  if (images > 1) {
    content.push({
      type: 'text',
      text: `The ${images} images above are screenshots in capture order; consecutive ones may overlap where the page was scrolled. Read them together as one problem, including constraints and sample input/output.`
    })
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
