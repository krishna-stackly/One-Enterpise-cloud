import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LoginPage } from '@/features/auth/LoginPage'

describe('LoginPage', () => {
  it('validates email before submit', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )
    const email = screen.getByLabelText('Email')
    await user.clear(email)
    await user.type(email, 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByText(/valid work email/i)).toBeInTheDocument()
  })

  it('shows demo accounts for Scrum Master, Mentor, and POC', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )
    expect(screen.getByText('Scrum Master')).toBeInTheDocument()
    expect(screen.getByText('Mentor / POC')).toBeInTheDocument()
    expect(screen.getByText('POC')).toBeInTheDocument()
    expect(screen.queryByText('Associate')).not.toBeInTheDocument()
  })
})
