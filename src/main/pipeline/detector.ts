import type { ContentPart, DetectionResult, ProblemType } from '../../shared/types'
import type { LLMProvider } from '../providers/LLMProvider'

interface Signal {
  pattern: RegExp
  weight: number
}

/**
 * Keyword signals per problem type. Weights are rough log-odds: a 3 is close to
 * decisive on its own, a 1 only nudges. Patterns are written in lower case, run
 * against lower-cased text, and each pattern counts once.
 */
const SIGNALS: Record<ProblemType, Signal[]> = {
  dsa: [
    { pattern: /\bleetcode\b|\bhackerrank\b|\bcodeforces\b/, weight: 3 },
    { pattern: /\bexample\s*\d*\s*:?\s*\n?\s*input\b|\binput\s*:.*\n?.*\boutput\s*:/s, weight: 3 },
    { pattern: /\bconstraints\s*:|\b\d+\s*<=\s*\w+(\.length)?\s*<=|10\^\d|10\s*\*\*\s*\d/, weight: 3 },
    { pattern: /\bgiven (an?|the) (integer |sorted |binary |string )?(array|string|list|tree|graph|matrix|grid|linked list)\b/, weight: 3 },
    { pattern: /\b(sub)?arrays?\b|\bsubsequence\b|\bsubstring\b|\bmatrix\b|\bgrid\b/, weight: 1 },
    { pattern: /\blinked list\b|\bbinary (search )?tree\b|\bbst\b|\btrie\b|\bheap\b|\bpriority queue\b/, weight: 2 },
    { pattern: /\bdynamic programming\b|\bdp\b|\bmemoi[sz]|\bbacktrack|\bgreedy\b|\brecursion\b/, weight: 2 },
    { pattern: /\btwo pointers?\b|\bsliding window\b|\bbinary search\b|\bprefix sum\b|\bbit manipulation\b/, weight: 2 },
    { pattern: /\bbfs\b|\bdfs\b|\bdijkstra\b|\btopological\b|\bunion[- ]find\b|\bshortest path\b/, weight: 2 },
    { pattern: /\breturn (the|an?|true|false)\b|\bfind the (minimum|maximum|number|kth|longest|shortest)\b/, weight: 2 },
    { pattern: /\btime complexity\b|\bspace complexity\b|\bo\((1|n|log n|n log n|n\^?2|m \* n|n \+ m)\)/, weight: 2 },
    { pattern: /\b(lru|lfu) cache\b|\bmin stack\b|\bget and put\b/, weight: 2 },
    { pattern: /\bnums\b|\btarget\b|\bindices\b/, weight: 1 }
  ],
  lld: [
    { pattern: /\blow[- ]level design\b|\blld\b|\bmachine coding\b|\bobject[- ]oriented design\b|\booad\b/, weight: 4 },
    { pattern: /\bclass diagram\b|\buml\b|\bdesign patterns?\b|\bsolid principles?\b/, weight: 3 },
    { pattern: /\b(design|implement|model) (a|an|the) .*\b(class|classes|classes and interfaces|object model)\b/, weight: 3 },
    { pattern: /\bparking lot\b|\belevator\b|\bvending machine\b|\bsplitwise\b|\btic[- ]tac[- ]toe\b|\bchess\b|\bsnake and ladder\b|\blibrary management\b|\bmovie ticket\b|\bbookmyshow\b|\batm\b|\blogger\b|\bcoffee machine\b/, weight: 3 },
    { pattern: /\bsingleton\b|\bfactory\b|\bstrategy pattern\b|\bobserver\b|\bdecorator\b|\bbuilder pattern\b|\bstate pattern\b|\badapter\b/, weight: 2 },
    { pattern: /\bclasses\b|\binterfaces?\b|\binheritance\b|\bpolymorphism\b|\bencapsulation\b|\babstract class\b|\bcomposition\b/, weight: 1 },
    { pattern: /\bentities\b|\bextensible\b|\bthread[- ]safe\b|\bconcurrency\b/, weight: 1 },
    { pattern: /\boop\b|\bobject[- ]oriented\b/, weight: 2 }
  ],
  hld: [
    { pattern: /\bsystem design\b|\bhigh[- ]level design\b|\bhld\b|\barchitect(ure)? (for|of)\b/, weight: 4 },
    { pattern: /\b(design|build|architect) (a |an )?(twitter|instagram|whatsapp|youtube|netflix|uber|tinyurl|url shortener|google drive|dropbox|news feed|chat (system|app)|notification (system|service)|search engine|web crawler|ticketmaster|typeahead|autocomplete)\b/, weight: 4 },
    { pattern: /\bmillions? (of )?(users|requests|dau|mau)\b|\bbillions?\b|\bdau\b|\bmau\b|\bqps\b|\brps\b|\bat scale\b|\bscalab(le|ility)\b/, weight: 3 },
    { pattern: /\bload balancer\b|\bcdn\b|\bsharding\b|\bpartition(ing)?\b|\breplication\b|\bconsistent hashing\b|\bmessage queue\b|\bkafka\b|\bpub[/-]?sub\b/, weight: 2 },
    { pattern: /\bmicroservices?\b|\bdistributed\b|\bhigh(ly)? availab(le|ility)\b|\bfault[- ]toleran(t|ce)\b|\bcap theorem\b|\beventual(ly)? consisten(t|cy)\b/, weight: 2 },
    { pattern: /\blatency\b|\bthroughput\b|\bcapacity estimation\b|\bback[- ]of[- ]the[- ]envelope\b|\bstorage estimate\b|\bsla\b/, weight: 2 },
    { pattern: /\bredis\b|\bcassandra\b|\bdynamodb\b|\bnosql\b|\bdatabase schema\b|\bapi (design|contracts?|endpoints?)\b|\brest api\b/, weight: 1 },
    { pattern: /\brate limiter\b|\bkey[- ]value store\b|\bdistributed cache\b/, weight: 2 }
  ]
}

export const TYPES: ProblemType[] = ['dsa', 'lld', 'hld']

/** Below this top score the heuristic is considered unsure. */
const MIN_SCORE = 3
/** Below this share of the total score the heuristic is considered unsure. */
const MIN_CONFIDENCE = 0.55

export function scoreText(text: string): Record<ProblemType, number> {
  const lower = text.toLowerCase()
  const scores = { dsa: 0, lld: 0, hld: 0 }
  for (const type of TYPES) {
    for (const { pattern, weight } of SIGNALS[type]) {
      if (pattern.test(lower)) scores[type] += weight
    }
  }
  return scores
}

export function detectHeuristic(text: string): DetectionResult & { certain: boolean } {
  const scores = scoreText(text)
  const total = scores.dsa + scores.lld + scores.hld
  const ranked = [...TYPES].sort((a, b) => scores[b] - scores[a])
  const top = ranked[0]
  // With no signal at all, DSA is the most common case for pasted problems.
  const type = total === 0 ? 'dsa' : top
  const confidence = total === 0 ? 0 : scores[top] / total
  return {
    type,
    confidence,
    method: 'heuristic',
    scores,
    certain: scores[top] >= MIN_SCORE && confidence >= MIN_CONFIDENCE
  }
}

const CLASSIFIER_SYSTEM = `You classify software engineering interview and design problems.
Reply with exactly one word:
- dsa: a data structures and algorithms / coding problem with a precise input and output
- lld: low-level / object-oriented design of classes, interfaces and patterns for one component
- hld: system design of a distributed service: scale, storage, APIs, architecture`

export function parseClassification(reply: string): ProblemType | undefined {
  const match = reply.toLowerCase().match(/\b(dsa|lld|hld)\b/)
  return match?.[1] as ProblemType | undefined
}

export interface DetectOptions {
  provider?: LLMProvider
  /** Ask the provider when the heuristic is unsure. */
  llmFallback: boolean
  images?: ContentPart[]
  signal?: AbortSignal
}

/**
 * Keyword heuristics first; the model is only consulted when they are unsure
 * (or when the problem is only an image), so most requests cost no extra call.
 */
export async function detectProblemType(text: string, options: DetectOptions): Promise<DetectionResult> {
  const heuristic = detectHeuristic(text)
  const imageOnly = text.trim().length === 0 && (options.images?.length ?? 0) > 0
  const { certain, ...result } = heuristic
  if ((certain && !imageOnly) || !options.llmFallback || !options.provider) return result

  try {
    const reply = await options.provider.complete({
      system: CLASSIFIER_SYSTEM,
      messages: [
        {
          role: 'user',
          content: [...(options.images ?? []), { type: 'text', text: text || 'Classify the problem in the image.' }]
        }
      ],
      // Generous ceiling: reasoning models spend tokens thinking before the one-word answer.
      maxTokens: 2048,
      temperature: 0,
      effort: 'low',
      signal: options.signal
    })
    const type = parseClassification(reply)
    if (type) return { type, confidence: 0.9, method: 'llm', scores: result.scores }
  } catch {
    // Classification is best-effort; fall back to the heuristic answer.
  }
  return result
}
