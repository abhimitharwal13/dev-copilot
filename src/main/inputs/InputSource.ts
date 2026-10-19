import type { ContextBuffer } from './ContextBuffer'

/**
 * An input stream that feeds the context buffer: clipboard and screen
 * region capture today, Whisper transcription in a later iteration.
 * Sources are started once at app launch and stopped on quit.
 */
export interface InputSource {
  readonly id: string
  /** Whether the source can run on this machine (permissions, binaries, models). */
  isAvailable(): Promise<boolean>
  start(buffer: ContextBuffer): Promise<void> | void
  stop(): Promise<void> | void
}

/** A screenshot as base64 (no `data:` prefix). Large captures fall back to JPEG. */
export interface CapturedImage {
  data: string
  mediaType: 'image/png' | 'image/jpeg'
}

/** Captures the screen, or a region of it, into the buffer (see ScreenCapture.ts). */
export interface ScreenCaptureService {
  /** Screenshots the whole display under the cursor at once, with no picker. */
  captureScreen(): Promise<CapturedImage | null>
  /**
   * Lets the user pick a region and resolves with the image, or null if
   * cancelled. Rejects with a user-facing message when the OS denies access.
   */
  captureRegion(): Promise<CapturedImage | null>
}

/**
 * Speech to text. Iteration 3 plugs in a local Whisper (whisper.cpp) server;
 * anything satisfying this interface works, including a cloud API.
 */
export interface TranscriptionService {
  isAvailable(): Promise<boolean>
  /** Transcribes one recorded utterance (16 kHz mono PCM WAV). */
  transcribe(audio: Uint8Array, options?: { language?: string; prompt?: string }): Promise<string>
}
