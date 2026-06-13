// =============================================================================
// ATELIER — Section 12: Snapshot Tests (SN-01 to SN-08)
// File: tests/snapshots/snapshots.test.tsx
// Tool: Vitest snapshot testing
// =============================================================================

import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import React from 'react'

import HeroPage from '@/components/HeroPage'
import Dashboard from '@/components/Dashboard'
import ThreadPage from '@/components/ThreadPage'
import VoteControl from '@/components/VoteControl'
import ProfilePage from '@/components/ProfilePage'
import PostCreationForm from '@/components/PostCreationForm'
import SearchResults from '@/components/SearchResults'

const mockDisciplines = [
  { id: 'd-1', slug: 'graphic-design', name: 'Graphic Design' },
  { id: 'd-2', slug: 'motion-design', name: 'Motion Design' },
]
const mockStats = { members: 1200, posts: 3400, disciplines: 8 }
const mockProfile = {
  id: 'u-1', username: 'alice', bio: 'Designer', reputation: 450,
  discipline: { id: 'd-1', slug: 'graphic-design', name: 'Graphic Design' },
  skills: ['Typography'], softwares: ['Figma'],
}
const mockPost = {
  id: 'p-1', title: 'Test Post', slug: 'test-post', content: 'Post body',
  type: 'DISCUSSION', voteCount: 5, commentCount: 2,
  author: { username: 'alice' }, discipline: { slug: 'graphic-design', name: 'Graphic Design' },
  acceptedCommentId: null, deletedAt: null,
}
const mockComments = [
  { id: 'c-1', content: 'First comment', voteCount: 3, author: { username: 'bob' }, deletedAt: null },
]

describe('Snapshot Tests', () => {
  it('SN-01: Hero page — desktop baseline', () => {
    const { container } = render(<HeroPage disciplines={mockDisciplines} stats={mockStats} />)
    expect(container).toMatchSnapshot()
  })

  it('SN-02: Dashboard — authenticated state with mock profile + feed', () => {
    const { container } = render(<Dashboard profile={mockProfile} feed={[mockPost]} />)
    expect(container).toMatchSnapshot()
  })

  it('SN-03: Thread page — with SOLVED badge (HELP post, accepted answer)', () => {
    const solvedPost = { ...mockPost, type: 'HELP', acceptedCommentId: 'c-1' }
    const { container } = render(<ThreadPage post={solvedPost} comments={mockComments} currentUserId={null} />)
    expect(container).toMatchSnapshot()
  })

  it('SN-04: Thread page — without SOLVED badge (DISCUSSION post)', () => {
    const { container } = render(<ThreadPage post={mockPost} comments={mockComments} currentUserId={null} />)
    expect(container).toMatchSnapshot()
  })

  it('SN-05: Profile page — full data state', () => {
    const { container } = render(<ProfilePage profile={mockProfile} />)
    expect(container).toMatchSnapshot()
  })

  it('SN-06: Post creation form — empty state', () => {
    const { container } = render(<PostCreationForm disciplines={mockDisciplines} onSubmit={async () => {}} />)
    expect(container).toMatchSnapshot()
  })

  it('SN-07: Vote control — upvoted state', () => {
    const { container } = render(
      <VoteControl voteCount={7} isOwner={false} currentVote="UP" onVote={async () => {}} />
    )
    expect(container).toMatchSnapshot()
  })

  it('SN-08: Search results — with 3 result cards', () => {
    const results = [
      { ...mockPost, id: 'p-1', slug: 'r-1', title: 'Result One' },
      { ...mockPost, id: 'p-2', slug: 'r-2', title: 'Result Two' },
      { ...mockPost, id: 'p-3', slug: 'r-3', title: 'Result Three' },
    ]
    const { container } = render(<SearchResults results={results} query="test" />)
    expect(container).toMatchSnapshot()
  })
})
