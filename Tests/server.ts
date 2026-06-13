/**
 * ATELIER — MSW Node Server
 * File: tests/msw/server.ts
 *
 * Creates the MSW server used in Vitest API route tests (Section 10).
 * Imported by tests/setup.ts which starts/resets/stops it automatically.
 *
 * Usage in individual test files (to override a handler for one test):
 *
 *   import { server } from '@tests/msw/server'
 *   import { http, HttpResponse } from 'msw'
 *
 *   test('handles 500', () => {
 *     server.use(http.get('/api/posts', () => HttpResponse.json({ error: 'fail' }, { status: 500 })))
 *     // ...
 *   })
 */

import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
