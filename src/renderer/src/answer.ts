import type { ProblemType } from '../../shared/types'

/** The template section whose code blocks make up the copyable solution. */
const CODE_SECTION: Partial<Record<ProblemType, string>> = { dsa: 'Code', lld: 'Implementation', db: 'Tables' }

function codeBlocks(markdown: string): string[] {
  return [...markdown.matchAll(/```([\w+#-]*)\n([\s\S]*?)```/g)]
    .filter((m) => m[1] !== 'mermaid')
    .map((m) => m[2].replace(/\n$/, ''))
}

/**
 * The solution code of an answer: every code block in the type's code section
 * (an LLD implementation is often split across several), else the last block.
 */
export function solutionCode(markdown: string, type: ProblemType | undefined): string | undefined {
  const heading = type && CODE_SECTION[type]
  if (heading) {
    const section = markdown.split(/^## /m).find((s) => s.startsWith(`${heading}\n`))
    const blocks = section ? codeBlocks(section) : []
    if (blocks.length > 0) return blocks.join('\n\n')
  }
  return codeBlocks(markdown).at(-1)
}

/** The conversation as one Markdown document, for saving. */
export function conversationMarkdown(turns: { prompt: string; answer: string }[], label: string): string {
  const title = turns[0]?.prompt.trim().split('\n')[0] || 'Problem'
  const body = turns
    .map((t, i) => `${i === 0 ? '' : `---\n\n> ${t.prompt.trim().replace(/\n/g, '\n> ')}\n\n`}${t.answer.trim()}`)
    .join('\n\n')
  return `# ${title}\n\n_${label} · Dev Copilot_\n\n${body}\n`
}

export function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'answer'
}
