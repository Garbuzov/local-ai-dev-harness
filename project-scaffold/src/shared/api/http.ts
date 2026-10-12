import type { z } from 'zod'

/**
 * Application boundaries: any external data arrives as `unknown` and is validated
 * by a schema. The result type is inferred from the schema — there is no need to duplicate it by hand.
 */

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export interface RequestOptions {
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 10_000

export async function getJson<T>(
  url: string,
  schema: z.ZodType<T>,
  options: RequestOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const timeoutSignal = AbortSignal.timeout(timeoutMs)

  // Cancellation by the calling code and the timeout must work simultaneously.
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal

  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal })

  if (!response.ok) {
    throw new HttpError(response.status, url, `GET ${url} failed with ${response.status}`)
  }

  const payload: unknown = await response.json()
  const parsed = schema.safeParse(payload)

  if (!parsed.success) {
    throw new HttpError(response.status, url, `GET ${url} returned an unexpected payload`)
  }

  return parsed.data
}
