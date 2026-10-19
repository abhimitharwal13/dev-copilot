import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ContextBuffer } from '../src/main/inputs/ContextBuffer'
import { type SecretCodec, SettingsStore } from '../src/main/settings/SettingsStore'

const codec: SecretCodec = {
  encrypt: (s) => `x:${[...s].reverse().join('')}`,
  decrypt: (s) => [...s.slice(2)].reverse().join('')
}

describe('SettingsStore', () => {
  const file = () => join(mkdtempSync(join(tmpdir(), 'dcp-')), 'settings.json')

  it('starts from defaults and persists updates', () => {
    const path = file()
    const store = new SettingsStore(path, codec)
    expect(store.get().activeProvider).toBe('claudecode')
    store.update({ activeProvider: 'ollama', providers: { ollama: { model: 'llama3' } } })
    const reloaded = new SettingsStore(path, codec)
    expect(reloaded.get().activeProvider).toBe('ollama')
    expect(reloaded.get().providers.ollama.model).toBe('llama3')
  })

  it('moves keyless Anthropic setups from older versions onto the Claude subscription provider', () => {
    const keyless = file()
    writeFileSync(keyless, JSON.stringify({ schemaVersion: 2, activeProvider: 'anthropic', providers: {} }))
    expect(new SettingsStore(keyless, codec).get().activeProvider).toBe('claudecode')
    const withKey = file()
    writeFileSync(
      withKey,
      JSON.stringify({ schemaVersion: 2, activeProvider: 'anthropic', providers: { anthropic: { model: 'm', encryptedApiKey: 'x:k' } } })
    )
    expect(new SettingsStore(withKey, codec).get().activeProvider).toBe('anthropic')
  })

  it('encrypts API keys on disk and hides them from the public view', () => {
    const path = file()
    const store = new SettingsStore(path, codec)
    store.update({ providers: { anthropic: { apiKey: 'sk-secret' } } })
    expect(readFileSync(path, 'utf8')).not.toContain('sk-secret')
    expect(store.getPublic().providers.anthropic).toMatchObject({ hasApiKey: true })
    expect(JSON.stringify(store.getPublic())).not.toContain('sk-secret')
    expect(new SettingsStore(path, codec).get().providers.anthropic.apiKey).toBe('sk-secret')
  })

  it('clears a key when given an empty string', () => {
    const store = new SettingsStore(file(), codec)
    store.update({ providers: { groq: { apiKey: 'k' } } })
    store.update({ providers: { groq: { apiKey: '' } } })
    expect(store.getPublic().providers.groq.hasApiKey).toBe(false)
  })
})

describe('ContextBuffer', () => {
  it('adds, selects, removes and notifies', () => {
    const buffer = new ContextBuffer()
    const seen: number[] = []
    buffer.onChange((items) => seen.push(items.length))
    const a = buffer.addText('  code  ')
    const b = buffer.addImageDataUrl('data:image/png;base64,AAAA')
    expect(a).toMatchObject({ kind: 'text', text: 'code' })
    expect(b).toMatchObject({ kind: 'image', mediaType: 'image/png', data: 'AAAA' })
    expect(buffer.select([b.id])).toEqual([b])
    buffer.remove(a.id)
    expect(buffer.list()).toEqual([b])
    expect(seen).toEqual([1, 2, 1])
  })

  it('rejects empty text and unsupported images', () => {
    const buffer = new ContextBuffer()
    expect(() => buffer.addText('   ')).toThrow()
    expect(() => buffer.addImageDataUrl('data:image/tiff;base64,AAAA')).toThrow(/Unsupported/)
  })
})

describe('SettingsStore defaults and migration', () => {
  const file = () => join(mkdtempSync(join(tmpdir(), 'dcp-')), 'settings.json')

  it('defaults to Java and a translucent always-on-top overlay', () => {
    const s = new SettingsStore(file(), codec).get()
    expect(s.preferredLanguage).toBe('Java')
    expect(s.overlay).toEqual({ backgroundOpacity: 0.55, alwaysOnTop: true })
    expect(s.shortcuts.customPrompt).toBe('CommandOrControl+Shift+K')
  })

  it('moves files saved with the old Python default to Java, but keeps a later explicit choice', () => {
    const path = file()
    writeFileSync(path, JSON.stringify({ preferredLanguage: 'Python', shortcuts: { toggleWindow: 'F9' } }))
    const migrated = new SettingsStore(path, codec)
    expect(migrated.get().preferredLanguage).toBe('Java')
    expect(migrated.get().shortcuts).toMatchObject({ toggleWindow: 'F9', customPrompt: 'CommandOrControl+Shift+K' })

    migrated.update({ preferredLanguage: 'Python' })
    expect(new SettingsStore(path, codec).get().preferredLanguage).toBe('Python')
  })

  it('clamps background opacity', () => {
    const store = new SettingsStore(file(), codec)
    expect(store.update({ overlay: { backgroundOpacity: 0 } }).overlay.backgroundOpacity).toBe(0.1)
    expect(store.update({ overlay: { backgroundOpacity: 3 } }).overlay).toEqual({ backgroundOpacity: 1, alwaysOnTop: true })
  })
})
