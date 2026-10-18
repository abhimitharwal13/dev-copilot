import { randomUUID } from 'node:crypto'
import type { ContextItem, ContextSource } from '../../shared/types'

type ImageMediaType = Extract<ContextItem, { kind: 'image' }>['mediaType']
type Listener = (items: ContextItem[]) => void

const IMAGE_TYPES: ImageMediaType[] = ['image/png', 'image/jpeg', 'image/webp']
/** Keep the buffer bounded; oldest items drop first. */
const MAX_ITEMS = 20

/**
 * The scratchpad every input stream writes into: typed text, clipboard,
 * and later screen captures and voice transcripts.
 */
export class ContextBuffer {
  private items: ContextItem[] = []
  private readonly listeners = new Set<Listener>()

  list(): ContextItem[] {
    return [...this.items]
  }

  /** Items by id, in buffer order. With no ids, the whole buffer. */
  select(ids?: string[]): ContextItem[] {
    if (!ids) return this.list()
    const wanted = new Set(ids)
    return this.items.filter((i) => wanted.has(i.id))
  }

  addText(text: string, source: ContextSource = 'typed'): ContextItem {
    const trimmed = text.trim()
    if (!trimmed) throw new Error('Cannot add empty text to the context buffer.')
    return this.push({ id: randomUUID(), kind: 'text', source, text: trimmed, createdAt: Date.now() })
  }

  /** Accepts a `data:image/...;base64,` URL. */
  addImageDataUrl(dataUrl: string, source: ContextSource = 'paste'): ContextItem {
    const match = /^data:(image\/[a-z]+);base64,(.+)$/s.exec(dataUrl)
    if (!match) throw new Error('Expected a base64 image data URL.')
    const mediaType = match[1] as ImageMediaType
    if (!IMAGE_TYPES.includes(mediaType)) throw new Error(`Unsupported image type: ${match[1]}`)
    return this.addImage(match[2], mediaType, source)
  }

  addImage(data: string, mediaType: ImageMediaType, source: ContextSource): ContextItem {
    return this.push({ id: randomUUID(), kind: 'image', source, data, mediaType, createdAt: Date.now() })
  }

  remove(id: string): void {
    this.items = this.items.filter((i) => i.id !== id)
    this.notify()
  }

  clear(): void {
    this.items = []
    this.notify()
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private push(item: ContextItem): ContextItem {
    this.items = [...this.items, item].slice(-MAX_ITEMS)
    this.notify()
    return item
  }

  private notify(): void {
    const snapshot = this.list()
    for (const listener of this.listeners) listener(snapshot)
  }
}
