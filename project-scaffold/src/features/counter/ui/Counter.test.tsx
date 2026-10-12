import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Counter } from '@/features/counter/ui/Counter'

describe('Counter', () => {
  it('shows the initial value', () => {
    render(<Counter initialValue={5} />)

    expect(screen.getByRole('status')).toHaveTextContent('5')
  })

  it('defaults to zero when no initial value is given', () => {
    render(<Counter />)

    expect(screen.getByRole('status')).toHaveTextContent('0')
  })

  it('increments and decrements on click', async () => {
    const user = userEvent.setup()
    render(<Counter initialValue={1} />)

    await user.click(screen.getByRole('button', { name: 'Increment' }))
    await user.click(screen.getByRole('button', { name: 'Increment' }))
    expect(screen.getByRole('status')).toHaveTextContent('3')

    await user.click(screen.getByRole('button', { name: 'Decrement' }))
    expect(screen.getByRole('status')).toHaveTextContent('2')
  })

  it('resets back to the initial value', async () => {
    const user = userEvent.setup()
    render(<Counter initialValue={7} />)

    await user.click(screen.getByRole('button', { name: 'Increment' }))
    await user.click(screen.getByRole('button', { name: 'Reset' }))

    expect(screen.getByRole('status')).toHaveTextContent('7')
  })
})
