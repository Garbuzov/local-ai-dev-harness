import { useCounter } from '@/features/counter/model/useCounter'

interface CounterProps {
  readonly initialValue?: number
}

export function Counter({ initialValue }: CounterProps) {
  const { value, increment, decrement, reset } = useCounter(initialValue ?? 0)

  return (
    <section aria-labelledby="counter-heading">
      <h2 id="counter-heading">Counter</h2>
      <p>
        Value: <output className="value">{value}</output>
      </p>
      <button type="button" onClick={increment}>
        Increment
      </button>
      <button type="button" onClick={decrement}>
        Decrement
      </button>
      <button type="button" onClick={reset}>
        Reset
      </button>
    </section>
  )
}
