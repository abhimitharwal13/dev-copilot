import { useCallback, useEffect, useRef, useState } from 'react'
import type { DetectionResult, ProblemType, SolveEvent, TokenUsage } from '../../../shared/types'
import { api } from '../api'

export interface Turn {
  id: string
  prompt: string
  answer: string
  status: 'streaming' | 'done' | 'error' | 'cancelled'
  error?: string
  usage?: TokenUsage
}

export interface SolveState {
  conversationId?: string
  detection?: DetectionResult
  turns: Turn[]
  busy: boolean
}

/** Owns one conversation: the first `ask` detects the type, later ones are follow-ups. */
export function useSolve() {
  const [state, setState] = useState<SolveState>({ turns: [], busy: false })
  const activeRequest = useRef<string | null>(null)

  useEffect(
    () =>
      api.solve.onEvent((event: SolveEvent) => {
        if (event.requestId !== activeRequest.current) return
        setState((s) => reduce(s, event))
        if (event.type === 'done' || event.type === 'error') activeRequest.current = null
      }),
    []
  )

  const ask = useCallback(
    async (prompt: string, options: { problemType?: ProblemType; contextIds?: string[] } = {}) => {
      const turnId = crypto.randomUUID()
      setState((s) => ({
        ...s,
        busy: true,
        turns: [...s.turns, { id: turnId, prompt, answer: '', status: 'streaming' }]
      }))
      const requestId = crypto.randomUUID()
      activeRequest.current = requestId
      await api.solve.start({
        requestId,
        conversationId: state.conversationId,
        prompt,
        problemType: options.problemType,
        contextIds: options.contextIds
      })
    },
    [state.conversationId]
  )

  const cancel = useCallback(() => {
    if (!activeRequest.current) return
    void api.solve.cancel(activeRequest.current)
    activeRequest.current = null
    setState((s) => ({ ...s, busy: false, turns: patchLast(s.turns, { status: 'cancelled' }) }))
  }, [])

  const reset = useCallback(() => {
    if (state.conversationId) void api.solve.resetConversation(state.conversationId)
    activeRequest.current = null
    setState({ turns: [], busy: false })
  }, [state.conversationId])

  return { state, ask, cancel, reset }
}

function patchLast(turns: Turn[], patch: Partial<Turn>): Turn[] {
  if (turns.length === 0) return turns
  return [...turns.slice(0, -1), { ...turns[turns.length - 1], ...patch }]
}

function reduce(s: SolveState, event: SolveEvent): SolveState {
  const last = s.turns[s.turns.length - 1]
  switch (event.type) {
    case 'started':
      return { ...s, conversationId: event.conversationId }
    case 'detected':
      return { ...s, detection: event.detection }
    case 'delta':
      return { ...s, turns: patchLast(s.turns, { answer: (last?.answer ?? '') + event.text }) }
    case 'done':
      return { ...s, busy: false, turns: patchLast(s.turns, { answer: event.text, status: 'done', usage: event.usage }) }
    case 'error':
      return { ...s, busy: false, turns: patchLast(s.turns, { status: 'error', error: event.message }) }
  }
}
