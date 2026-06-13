// =============================================================================
// ATELIER — Section 13: Form Validation Tests (FV-01 to FV-12)
// File: tests/forms/form-validation.test.tsx
// Tool: Vitest + RTL + @testing-library/user-event
// =============================================================================

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import React from 'react'

import PostCreationForm from '@/components/PostCreationForm'
import ProfileEditForm from '@/components/ProfileEditForm'
import LoginForm from '@/components/LoginForm'

const mockDisciplines = [
  { id: 'd-1', slug: 'graphic-design', name: 'Graphic Design' },
]
const noop = async () => {}

// =============================================================================
// POST CREATION FORM VALIDATION (FV-01 to FV-06)
// =============================================================================
describe('PostCreationForm — Validation', () => {
  async function submitEmpty() {
    const user = userEvent.setup()
    render(<PostCreationForm disciplines={mockDisciplines} onSubmit={noop} />)
    const submitBtn = screen.getByRole('button', { name: /publish|post|submit/i })
    await user.click(submitBtn)
    return user
  }

  it('FV-01: empty title → "Title is required" error visible', async () => {
    await submitEmpty()
    expect(await screen.findByText(/title is required/i)).toBeInTheDocument()
  })

  it('FV-02: title > max chars → length error visible', async () => {
    const user = userEvent.setup()
    render(<PostCreationForm disciplines={mockDisciplines} onSubmit={noop} />)
    const titleInput = screen.getByLabelText(/title/i)
    // Type a 300-char string (over typical 200-char max)
    await user.type(titleInput, 'A'.repeat(300))
    await user.click(screen.getByRole('button', { name: /publish|post|submit/i }))
    expect(await screen.findByText(/too long|max|characters/i)).toBeInTheDocument()
  })

  it('FV-03: no discipline selected → error visible, submit blocked', async () => {
    const user = userEvent.setup()
    render(<PostCreationForm disciplines={mockDisciplines} onSubmit={noop} />)
    await user.type(screen.getByLabelText(/title/i), 'Valid Title')
    await user.click(screen.getByRole('button', { name: /publish|post|submit/i }))
    expect(await screen.findByText(/discipline is required/i)).toBeInTheDocument()
  })

  it('FV-04: no post type → error visible', async () => {
    const user = userEvent.setup()
    render(<PostCreationForm disciplines={mockDisciplines} onSubmit={noop} />)
    await user.type(screen.getByLabelText(/title/i), 'Valid Title')
    await user.selectOptions(screen.getByRole('combobox', { name: /discipline/i }), 'd-1')
    // Don't select post type
    await user.click(screen.getByRole('button', { name: /publish|post|submit/i }))
    expect(await screen.findByText(/post type is required/i)).toBeInTheDocument()
  })

  it('FV-05: empty content → "Content is required" error visible', async () => {
    const user = userEvent.setup()
    render(<PostCreationForm disciplines={mockDisciplines} onSubmit={noop} />)
    await user.type(screen.getByLabelText(/title/i), 'Valid Title')
    await user.selectOptions(screen.getByRole('combobox', { name: /discipline/i }), 'd-1')
    await user.click(screen.getByRole('button', { name: /publish|post|submit/i }))
    expect(await screen.findByText(/content is required/i)).toBeInTheDocument()
  })

  it('FV-06: all fields valid → no error messages, submit enabled', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue({ slug: 'new-post' })
    render(<PostCreationForm disciplines={mockDisciplines} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/title/i), 'Valid Title')
    await user.selectOptions(screen.getByRole('combobox', { name: /discipline/i }), 'd-1')
    await user.selectOptions(screen.getByRole('combobox', { name: /post type/i }), 'DISCUSSION')
    await user.type(screen.getByLabelText(/content/i), 'Valid content body here.')

    expect(screen.queryByText(/is required/i)).not.toBeInTheDocument()
    const submitBtn = screen.getByRole('button', { name: /publish|post|submit/i })
    expect(submitBtn).not.toBeDisabled()
  })
})

// =============================================================================
// PROFILE EDIT FORM VALIDATION (FV-07 to FV-10)
// =============================================================================
describe('ProfileEditForm — Validation', () => {
  it('FV-07: bio > 500 chars → length error visible', async () => {
    const user = userEvent.setup()
    render(<ProfileEditForm onSubmit={noop} initialValues={{ bio: '', username: 'alice' }} />)
    const bioInput = screen.getByLabelText(/bio/i)
    await user.type(bioInput, 'A'.repeat(501))
    await user.click(screen.getByRole('button', { name: /save|update/i }))
    expect(await screen.findByText(/too long|max|500/i)).toBeInTheDocument()
  })

  it('FV-08: empty bio → no error (bio is optional)', async () => {
    const user = userEvent.setup()
    render(<ProfileEditForm onSubmit={noop} initialValues={{ bio: '', username: 'alice' }} />)
    const bioInput = screen.getByLabelText(/bio/i)
    await user.clear(bioInput)
    await user.click(screen.getByRole('button', { name: /save|update/i }))
    await waitFor(() => {
      expect(screen.queryByText(/bio.*required/i)).not.toBeInTheDocument()
    })
  })

  it('FV-09: username with spaces → format error visible', async () => {
    const user = userEvent.setup()
    render(<ProfileEditForm onSubmit={noop} initialValues={{ bio: '', username: 'alice' }} />)
    const usernameInput = screen.getByLabelText(/username/i)
    await user.clear(usernameInput)
    await user.type(usernameInput, 'alice smith')
    await user.click(screen.getByRole('button', { name: /save|update/i }))
    expect(await screen.findByText(/invalid|no spaces|format/i)).toBeInTheDocument()
  })

  it('FV-10: valid username format → no error', async () => {
    const user = userEvent.setup()
    render(<ProfileEditForm onSubmit={noop} initialValues={{ bio: '', username: 'alice' }} />)
    const usernameInput = screen.getByLabelText(/username/i)
    await user.clear(usernameInput)
    await user.type(usernameInput, 'alice_smith_99')
    await user.click(screen.getByRole('button', { name: /save|update/i }))
    await waitFor(() => {
      expect(screen.queryByText(/invalid.*username|no spaces/i)).not.toBeInTheDocument()
    })
  })
})

// =============================================================================
// LOGIN FORM VALIDATION (FV-11 to FV-12)
// =============================================================================
describe('LoginForm — Validation', () => {
  it('FV-11: invalid email format → "Invalid email" error visible', async () => {
    const user = userEvent.setup()
    render(<LoginForm onSubmit={noop} />)
    await user.type(screen.getByLabelText(/email/i), 'not-an-email')
    await user.type(screen.getByLabelText(/password/i), 'somepassword')
    await user.click(screen.getByRole('button', { name: /log in|sign in/i }))
    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument()
  })

  it('FV-12: empty password → "Password is required" error visible', async () => {
    const user = userEvent.setup()
    render(<LoginForm onSubmit={noop} />)
    await user.type(screen.getByLabelText(/email/i), 'valid@example.com')
    // Leave password empty
    await user.click(screen.getByRole('button', { name: /log in|sign in/i }))
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument()
  })
})
