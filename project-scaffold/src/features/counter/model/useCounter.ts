import { useCallback, useState } from 'react'

export interface CounterApi {
  readonly value: number
  increment: () => void
  decrement: () => void
  reset: () => void
}

/**
 * The counter logic is extracted from the component: it can be tested without rendering,
 * and the component stays thin.
 */
export function useCounter(initialValue = 0): CounterApi {
  const [value, setValue] = useState(initialValue)

  const increment = useCallback(() => {
    setValue((current) => current + 1)
  }, [])

  const decrement = useCallback(() => {
    setValue((current) => current - 1)
  }, [])

  const reset = useCallback(() => {
    setValue(initialValue)
  }, [initialValue])

  return { value, increment, decrement, reset }
}
