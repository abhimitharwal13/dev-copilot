/**
 * Minimal streaming line readers for provider HTTP responses.
 * Uses only `fetch` so providers carry no SDK dependencies.
 */

async function* readLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let newline: number
      while ((newline = buffer.indexOf('\n')) !== -1) {
        yield buffer.slice(0, newline).replace(/\r$/, '')
        buffer = buffer.slice(newline + 1)
      }
    }
    buffer += decoder.decode()
    if (buffer.length > 0) yield buffer
  } finally {
    reader.releaseLock()
  }
}

export interface SseEvent {
  event?: string
  data: string
}

/** Parses a `text/event-stream` body into events. */
export async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
  let event: string | undefined
  let data: string[] = []
  for await (const line of readLines(body)) {
    if (line === '') {
      if (data.length > 0) yield { event, data: data.join('\n') }
      event = undefined
      data = []
    } else if (line.startsWith('event:')) {
      event = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      data.push(line.slice(5).replace(/^ /, ''))
    }
  }
  if (data.length > 0) yield { event, data: data.join('\n') }
}
