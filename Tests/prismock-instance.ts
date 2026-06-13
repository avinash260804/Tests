/**
 * ATELIER — Prismock Singleton
 * File: tests/factories/prismock-instance.ts
 *
 * Exports a single PrismockClient instance shared across all unit tests.
 * Vitest's setup.ts calls reset() after each test to clear in-memory state.
 *
 * Usage in test files:
 *   import { prismock } from '@tests/factories/prismock-instance'
 *   vi.mock('@/lib/prisma', () => ({ prisma: prismock }))
 */

import { PrismockClient } from 'prismock'

export const prismock = new PrismockClient()
