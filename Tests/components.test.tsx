// =============================================================================
// ATELIER — Section 11: Component Tests (C-01 to C-30)
// File: src/__tests__/components/components.test.tsx
// Tool: Vitest + React Testing Library + @testing-library/user-event
// =============================================================================

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import React from 'react'

// ── Component imports — adjust paths to match your project ────────────────
import HeroPage from '@/components/HeroPage'
import Dashboard from '@/components/Dashboard'
import ThreadPage from '@/components/ThreadPage'
import VoteControl from '@/components/VoteControl'
import ProfilePage from '@/components/ProfilePage'
import PostCreationForm from '@/components/PostCreationForm'

// ── Shared mock data ──────────────────────────────────────────────────────
const mockDisciplines = [
  { id: 'd-1', slug: 'graphic-design', name: 'Graphic Design' },
  { id: 'd-2', slug: 'motion-design', name: 'Motion Design' },
]

const mockStats = { members: 1200, posts: 3400, disciplines: 8 }

const mockProfile = {
  id: 'u-1', username: 'alice', bio: 'Designer', reputation: 450,
  discipline: { id: 'd-1', slug: 'graphic-design', name: 'Graphic Design' },
  skills: ['Typography', 'Layout'],
  softwares: ['Figma', 'Illustrator'],
}

const mockPost = {
  id: 'p-1', title: 'Test Post', slug: 'test-post', content: 'Post body',
  type: 'DISCUSSION', voteCount: 5, commentCount: 2,
  author: { username: 'alice' }, discipline: { slug: 'graphic-design', name: 'Graphic Design' },
  acceptedCommentId: null, deletedAt: null,
}

const mockComments = [
  { id: 'c-1', content: 'First comment', voteCount: 3, author: { username: 'bob' }, deletedAt: null },
  { id: 'c-2', content: 'Second comment', voteCount: 1, author: { username: 'carol' }, deletedAt: null },
]

const mockFeed = [mockPost]

// =============================================================================
// HERO PAGE (C-01 to C-05)
// =============================================================================
describe('HeroPage', () => {
  it('C-01: renders discipline pills from prop list', () => {
    render(<HeroPage disciplines={mockDisciplines} stats={mockStats} />)
    expect(screen.getByText('Graphic Design')).toBeInTheDocument()
    expect(screen.getByText('Motion Design')).toBeInTheDocument()
  })

  it('C-02: "Get Started" CTA href points to auth signup route (not #)', () => {
    render(<HeroPage disciplines={mockDisciplines} stats={mockStats} />)
    const cta = screen.getByRole('link', { name: /get started/i })
    expect(cta).toHaveAttribute('href')
    expect(cta.getAttribute('href')).not.toBe('#')
  })

  it('C-03: stats section shows all three metrics', () => {
    render(<HeroPage disciplines={mockDisciplines} stats={mockStats} />)
    expect(screen.getByText(/1[,.]?200/)).toBeInTheDocument() // members
    expect(screen.getByText(/3[,.]?400/)).toBeInTheDocument() // posts
    expect(screen.getByText('8')).toBeInTheDocument()          // disciplines
  })

  it('C-04: empty disciplines array → renders gracefully (no crash)', () => {
    expect(() => render(<HeroPage disciplines={[]} stats={mockStats} />)).not.toThrow()
  })

  it('C-05: platform name "Atelier" is in the document', () => {
    render(<HeroPage disciplines={mockDisciplines} stats={mockStats} />)
    expect(screen.getByText(/atelier/i)).toBeInTheDocument()
  })
})

// =============================================================================
// DASHBOARD (C-06 to C-11)
// =============================================================================
describe('Dashboard', () => {
  it('C-06: renders real username from profile prop', () => {
    render(<Dashboard profile={mockProfile} feed={mockFeed} />)
    expect(screen.getByText(/alice/i)).toBeInTheDocument()
  })

  it('C-07: renders discipline badge from profile prop', () => {
    render(<Dashboard profile={mockProfile} feed={mockFeed} />)
    expect(screen.getByText(/graphic design/i)).toBeInTheDocument()
  })

  it('C-08: renders reputation score', () => {
    render(<Dashboard profile={mockProfile} feed={mockFeed} />)
    expect(screen.getByText(/450/)).toBeInTheDocument()
  })

  it('C-09: feed section renders N post cards from feed prop', () => {
    render(<Dashboard profile={mockProfile} feed={[mockPost, { ...mockPost, id: 'p-2', slug: 'p-2' }]} />)
    expect(screen.getAllByRole('article').length).toBe(2)
  })

  it('C-10: feed empty state renders message when feed is []', () => {
    render(<Dashboard profile={mockProfile} feed={[]} />)
    expect(screen.getByText(/no posts yet|empty|get started/i)).toBeInTheDocument()
  })

  it('C-11: New Post button links to /create (not #)', () => {
    render(<Dashboard profile={mockProfile} feed={mockFeed} />)
    const btn = screen.getByRole('link', { name: /new post|create/i })
    expect(btn.getAttribute('href')).toContain('/create')
  })
})

// =============================================================================
// THREAD PAGE (C-12 to C-17)
// =============================================================================
describe('ThreadPage', () => {
  it('C-12: renders post title and content', () => {
    render(<ThreadPage post={mockPost} comments={mockComments} currentUserId={null} />)
    expect(screen.getByText('Test Post')).toBeInTheDocument()
    expect(screen.getByText('Post body')).toBeInTheDocument()
  })

  it('C-13: renders SOLVED badge when acceptedCommentId is set', () => {
    const solvedPost = { ...mockPost, type: 'HELP', acceptedCommentId: 'c-1' }
    render(<ThreadPage post={solvedPost} comments={mockComments} currentUserId={null} />)
    expect(screen.getByText(/solved/i)).toBeInTheDocument()
  })

  it('C-14: does NOT render SOLVED badge when no accepted answer', () => {
    render(<ThreadPage post={mockPost} comments={mockComments} currentUserId={null} />)
    expect(screen.queryByText(/solved/i)).not.toBeInTheDocument()
  })

  it('C-15: renders post type badge', () => {
    render(<ThreadPage post={mockPost} comments={mockComments} currentUserId={null} />)
    expect(screen.getByText(/discussion/i)).toBeInTheDocument()
  })

  it('C-16: renders all N comments from comments prop', () => {
    render(<ThreadPage post={mockPost} comments={mockComments} currentUserId={null} />)
    expect(screen.getByText('First comment')).toBeInTheDocument()
    expect(screen.getByText('Second comment')).toBeInTheDocument()
  })

  it('C-17: empty comment state when comments = []', () => {
    render(<ThreadPage post={mockPost} comments={[]} currentUserId={null} />)
    expect(screen.getByText(/no comments|be the first/i)).toBeInTheDocument()
  })
})

// =============================================================================
// VOTE CONTROL (C-18 to C-21)
// =============================================================================
describe('VoteControl', () => {
  const mockOnVote = vi.fn()

  it('C-18: renders correct vote count from prop', () => {
    render(<VoteControl voteCount={42} isOwner={false} currentVote={null} onVote={mockOnVote} />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('C-19: upvote button disabled when isOwner: true', () => {
    render(<VoteControl voteCount={0} isOwner={true} currentVote={null} onVote={mockOnVote} />)
    const upBtn = screen.getByRole('button', { name: /upvote/i })
    expect(upBtn).toBeDisabled()
  })

  it('C-20: downvote button disabled when isOwner: true', () => {
    render(<VoteControl voteCount={0} isOwner={true} currentVote={null} onVote={mockOnVote} />)
    const downBtn = screen.getByRole('button', { name: /downvote/i })
    expect(downBtn).toBeDisabled()
  })

  it('C-21: clicking upvote when unauthenticated triggers login prompt', async () => {
    const user = userEvent.setup()
    const onLoginPrompt = vi.fn()
    render(<VoteControl voteCount={0} isOwner={false} currentVote={null} onVote={mockOnVote} isAuthenticated={false} onLoginPrompt={onLoginPrompt} />)
    const upBtn = screen.getByRole('button', { name: /upvote/i })
    await user.click(upBtn)
    expect(onLoginPrompt).toHaveBeenCalled()
  })
})

// =============================================================================
// PROFILE PAGE (C-22 to C-25)
// =============================================================================
describe('ProfilePage', () => {
  it('C-22: renders discipline badge prominently', () => {
    render(<ProfilePage profile={mockProfile} />)
    expect(screen.getByText(/graphic design/i)).toBeInTheDocument()
  })

  it('C-23: renders skills list and software list', () => {
    render(<ProfilePage profile={mockProfile} />)
    expect(screen.getByText('Typography')).toBeInTheDocument()
    expect(screen.getByText('Figma')).toBeInTheDocument()
  })

  it('C-24: renders reputation score', () => {
    render(<ProfilePage profile={mockProfile} />)
    expect(screen.getByText(/450/)).toBeInTheDocument()
  })

  it('C-25: does NOT render follower/following counts', () => {
    render(<ProfilePage profile={mockProfile} />)
    expect(screen.queryByText(/followers?/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/following/i)).not.toBeInTheDocument()
  })
})

// =============================================================================
// POST CREATION FORM (C-26 to C-30)
// =============================================================================
describe('PostCreationForm', () => {
  const mockDisciplineOptions = mockDisciplines
  const mockOnSubmit = vi.fn()

  it('C-26: submit button disabled when discipline not selected', () => {
    render(<PostCreationForm disciplines={mockDisciplineOptions} onSubmit={mockOnSubmit} />)
    const submit = screen.getByRole('button', { name: /publish|post|submit/i })
    expect(submit).toBeDisabled()
  })

  it('C-27: submit button disabled when title is empty', async () => {
    const user = userEvent.setup()
    render(<PostCreationForm disciplines={mockDisciplineOptions} onSubmit={mockOnSubmit} />)
    // Select discipline but leave title empty
    const discSelect = screen.getByRole('combobox', { name: /discipline/i })
    await user.selectOptions(discSelect, 'd-1')
    const submit = screen.getByRole('button', { name: /publish|post|submit/i })
    expect(submit).toBeDisabled()
  })

  it('C-28: tag input calls /api/tags with debounced value', async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [{ name: 'typography' }],
    } as any)

    render(<PostCreationForm disciplines={mockDisciplineOptions} onSubmit={mockOnSubmit} />)
    const tagInput = screen.getByPlaceholderText(/tags/i)
    await user.type(tagInput, 'typ')

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/api/tags'))
    }, { timeout: 1500 })

    fetchSpy.mockRestore()
  })

  it('C-29: post type selector renders all 5 types', () => {
    render(<PostCreationForm disciplines={mockDisciplineOptions} onSubmit={mockOnSubmit} />)
    const types = ['DISCUSSION', 'HELP', 'CRITIQUE', 'SHOWCASE', 'RESOURCE']
    types.forEach(type => {
      expect(screen.getByRole('option', { name: new RegExp(type, 'i') })).toBeInTheDocument()
    })
  })

  it('C-30: successful submission redirects to /thread/[slug]', async () => {
    const { useRouter } = await import('next/navigation')
    const pushSpy = vi.fn()
    vi.mocked(useRouter).mockReturnValue({ push: pushSpy } as any)

    mockOnSubmit.mockResolvedValue({ slug: 'my-new-post' })
    const user = userEvent.setup()
    render(<PostCreationForm disciplines={mockDisciplineOptions} onSubmit={mockOnSubmit} />)

    // Fill in the required fields
    await user.type(screen.getByLabelText(/title/i), 'My New Post')
    await user.selectOptions(screen.getByRole('combobox', { name: /discipline/i }), 'd-1')
    await user.type(screen.getByLabelText(/content/i), 'Some content here')
    await user.click(screen.getByRole('button', { name: /publish|post|submit/i }))

    await waitFor(() => {
      expect(pushSpy).toHaveBeenCalledWith('/thread/my-new-post')
    })
  })
})
