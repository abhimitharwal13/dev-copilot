import type { ContextBuffer } from './ContextBuffer'

/**
 * An input stream that feeds the context buffer: clipboard today, screen
 * region capture and Whisper transcription in later iterations.
 * Sources are started once at app launch and stopped on quit.
 */
export interface InputSource {
  readonly id: string
  /** Whether the source can run on this machine (permissions, binaries, models). */
  isAvailable(): Promise<boolean>
  start(buffer: ContextBuffer): Promise<void> | void
  stop(): Promise<void> | void
}

/** Captures a region of the screen into the buffer. Implemented in iteration 2. */
export interface ScreenCaptureService {
  /** Lets the user pick a region and resolves with a PNG, or null if cancelled. */
  captureRegion(): Promise<{ data: string; mediaType: 'image/png' } | null>
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
