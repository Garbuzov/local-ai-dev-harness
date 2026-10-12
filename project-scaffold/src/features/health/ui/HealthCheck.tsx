import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'
import { HttpError, getJson } from '@/shared/api/http'
import { env } from '@/shared/config/env'

const healthSchema = z.object({ status: z.literal('ok') })

/** Screen state is a discriminated union, not a set of independent flags. */
type HealthState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly checkedAt: string }
  | { readonly kind: 'failed'; readonly reason: string }

function describeState(state: HealthState): string {
  switch (state.kind) {
    case 'idle':
      return 'Not checked yet'
    case 'loading':
      return 'Checking…'
    case 'ready':
      return `OK at ${state.checkedAt}`
    case 'failed':
      return `Failed: ${state.reason}`
  }
}

export function HealthCheck() {
  const [state, setState] = useState<HealthState>({ kind: 'idle' })
  const [attempt, setAttempt] = useState(0)

  const check = useCallback(async (signal: AbortSignal) => {
    if (env.VITE_API_URL === '') {
      setState({ kind: 'failed', reason: 'VITE_API_URL is not configured' })
      return
    }

    setState({ kind: 'loading' })

    try {
      await getJson(`${env.VITE_API_URL}/health`, healthSchema, { signal })
      setState({ kind: 'ready', checkedAt: new Date().toLocaleTimeString() })
    } catch (error) {
      if (signal.aborted) {
        return
      }
      const reason = error instanceof HttpError ? `HTTP ${String(error.status)}` : 'network error'
      setState({ kind: 'failed', reason })
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void check(controller.signal)
    return () => {
      controller.abort()
    }
  }, [check, attempt])

  return (
    <section aria-labelledby="health-heading">
      <h2 id="health-heading">Backend health</h2>
      <p>{describeState(state)}</p>
      <button type="button" onClick={() => setAttempt((current) => current + 1)}>
        Check again
      </button>
    </section>
  )
}
