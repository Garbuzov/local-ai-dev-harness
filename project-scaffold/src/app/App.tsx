import { Counter } from '@/features/counter/ui/Counter'
import { HealthCheck } from '@/features/health/ui/HealthCheck'

export function App() {
  return (
    <main className="app">
      <h1>Frontend App</h1>
      <Counter initialValue={0} />
      <HealthCheck />
    </main>
  )
}
