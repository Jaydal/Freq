import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('./booking-engine', () => ({ isSlotAvailable: vi.fn(), findAvailableCourt: vi.fn() }))
vi.mock('@/lib/mqtt', () => ({ publishDisplay: vi.fn() }))
vi.mock('./reservation-service', () => ({ finalizeBooking: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { isSlotAvailable } from './booking-engine'
import { finalizeBooking } from './reservation-service'
import { processCourt, processWaitingEntries } from './queue-processor'

function makeChain(overrides?: Record<string, any>) {
  return { select: vi.fn(() => chain), eq: vi.fn(() => chain), single: vi.fn(), order: vi.fn(() => chain), update: vi.fn(() => chain), in: vi.fn(() => chain), lt: vi.fn(() => chain), gte: vi.fn(() => chain), or: vi.fn(() => chain), ...overrides }
}

function makeDb() {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    single: vi.fn(),
    order: vi.fn(() => chain),
    update: vi.fn(() => chain),
    in: vi.fn(() => chain),
    lt: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    or: vi.fn(() => chain),
  }
  return { from: vi.fn((_: string) => chain), rpc: vi.fn() }
}

describe('processCourt', () => {
  beforeEach(() => vi.clearAllMocks())

  it('auto-books the next waiting entry when slot is available', async () => {
    vi.mocked(finalizeBooking).mockResolvedValue({ success: true })
    vi.mocked(isSlotAvailable).mockResolvedValue(true)
    const db = makeDb()
    db.from = vi.fn((t: string) => {
      const c: any = { select: vi.fn(), eq: vi.fn(), single: vi.fn(), order: vi.fn(), update: vi.fn(), in: vi.fn(), lt: vi.fn(), gte: vi.fn(), or: vi.fn() }
      c.select = vi.fn(() => c)
      c.eq = vi.fn(() => c)
      c.order = vi.fn(() => c)
      c.update = vi.fn(() => c)
      c.in = vi.fn(() => c)
      c.lt = vi.fn(() => c)
      c.gte = vi.fn(() => c)
      c.single = vi.fn()
      c.or = vi.fn(() => c)
      if (t === 'settings') {
        c.eq = vi.fn(() => c)
        c.single = vi.fn(async () => ({ data: { value: '300' }, error: null }))
      }
      if (t === 'queue_entries') {
        c.eq = vi.fn(() => c)
        c.order = vi.fn(async () => ({ data: [{ id: 'qe-1', member_id: 'm1', requested_start: '2026-07-07T14:00:00Z', duration: 60, party_size: 2, player_ids: ['m1', 'm2'] }], error: null }))
        // Mock the single() call for re-checking status
        c.single = vi.fn(async () => ({ data: { status: 'waiting' }, error: null }))
        // Mock the update().eq().eq().select() chain for atomic claim
        const select = vi.fn(async () => ({ data: [{ id: 'qe-1' }], error: null }))
        const eq2 = vi.fn(() => ({ select }))
        const eq1 = vi.fn(() => ({ eq: eq2 }))
        c.update = vi.fn(() => ({ eq: eq1 }))
      }
      return c
    })
    vi.mocked(createClient).mockResolvedValue(db as any)

    await processCourt('c1')
    expect(finalizeBooking).toHaveBeenCalledWith('qe-1', { bookCourt: true })
  })

  it('does nothing when queue is empty', async () => {
    const db = makeDb()
    db.from = vi.fn((t: string) => {
      const c: any = { select: vi.fn(), eq: vi.fn(), single: vi.fn(), order: vi.fn(), update: vi.fn(), in: vi.fn(), lt: vi.fn(), gte: vi.fn(), or: vi.fn() }
      c.select = vi.fn(() => c)
      c.eq = vi.fn(() => c)
      c.order = vi.fn(() => c)
      c.single = vi.fn()
      c.or = vi.fn(() => c)
      if (t === 'settings') {
        c.eq = vi.fn(() => c)
        c.single = vi.fn(async () => ({ data: { value: '300' }, error: null }))
      }
      if (t === 'queue_entries') {
        c.eq = vi.fn(() => c)
        c.order = vi.fn(async () => ({ data: [], error: null }))
      }
      return c
    })
    vi.mocked(createClient).mockResolvedValue(db as any)

    await processCourt('c1')
    // No error expected
  })
})

describe('processWaitingEntries', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeProcessWaitingDb(overrides?: { waitingEntries?: any[], activeGames?: any[], courts?: any[], finalizeBookingResult?: { success: boolean } }) {
    const entries = overrides?.waitingEntries ?? []
    const games = overrides?.activeGames ?? []
    const courts = overrides?.courts ?? []
    const acceptOk = overrides?.finalizeBookingResult ?? { success: true }
    vi.mocked(finalizeBooking).mockResolvedValue(acceptOk)
    vi.mocked(isSlotAvailable).mockResolvedValue(true)

    const db = makeDb()
    db.from = vi.fn((t: string) => {
      const c: any = { select: vi.fn(), eq: vi.fn(), single: vi.fn(), order: vi.fn(), update: vi.fn(), in: vi.fn(), lt: vi.fn(), gte: vi.fn(), or: vi.fn() }
      c.select = vi.fn(() => c)
      c.eq = vi.fn(() => c)
      c.order = vi.fn(() => c)
      c.single = vi.fn()
      c.or = vi.fn(() => c)
      c.update = vi.fn(() => c)
      c.limit = vi.fn(() => c)

      if (t === 'settings') {
        c.single = vi.fn(async () => ({ data: { value: '300' }, error: null }))
      } else if (t === 'queue_entries') {
        c.single = vi.fn(async () => ({ data: { status: 'waiting' }, error: null }))
        c.order = vi.fn(async () => ({ data: entries, error: null }))
        // Update().eq('id').eq('status').select() chain
        const select = vi.fn(async () => ({ data: entries.length > 0 ? [{ id: entries[0].id }] : [], error: null }))
        const eq2 = vi.fn(() => ({ select }))
        const eq1 = vi.fn(() => ({ eq: eq2 }))
        c.update = vi.fn(() => ({ eq: eq1 }))
      } else if (t === 'games') {
        c.select = vi.fn(() => c)
        c.eq = vi.fn(() => c)
        c.in = vi.fn(async () => ({ data: games, error: null }))
      } else if (t === 'courts') {
        c.order = vi.fn(async () => ({ data: courts, error: null }))
      }
      return c
    })
    vi.mocked(createClient).mockResolvedValue(db as any)
    return db
  }

  it('books first waiter on first available court', async () => {
    makeProcessWaitingDb({
      waitingEntries: [{ id: 'qe-1', member_id: 'm1', requested_start: '2026-07-07T14:00:00Z', duration: 60, party_size: 2, player_ids: ['m1'] }],
      courts: [{ id: 'c1' }],
    })
    await processWaitingEntries()
    expect(finalizeBooking).toHaveBeenCalledWith('qe-1', { bookCourt: true })
  })

  it('books two waiters on two available courts', async () => {
    makeProcessWaitingDb({
      waitingEntries: [
        { id: 'qe-1', member_id: 'm1', requested_start: '2026-07-07T14:00:00Z', duration: 60, party_size: 2, player_ids: ['m1'] },
        { id: 'qe-2', member_id: 'm2', requested_start: '2026-07-07T14:30:00Z', duration: 60, party_size: 2, player_ids: ['m2'] },
      ],
      courts: [{ id: 'c1' }, { id: 'c2' }],
    })
    await processWaitingEntries()
    expect(finalizeBooking).toHaveBeenCalledTimes(2)
    expect(finalizeBooking).toHaveBeenCalledWith('qe-1', { bookCourt: true })
    expect(finalizeBooking).toHaveBeenCalledWith('qe-2', { bookCourt: true })
  })

  it('does nothing when no waiters', async () => {
    makeProcessWaitingDb({ waitingEntries: [], courts: [{ id: 'c1' }] })
    await processWaitingEntries()
    expect(finalizeBooking).not.toHaveBeenCalled()
  })

  it('does nothing when all courts busy', async () => {
    makeProcessWaitingDb({
      waitingEntries: [{ id: 'qe-1', member_id: 'm1', requested_start: '2026-07-07T14:00:00Z', duration: 60, party_size: 2, player_ids: ['m1'] }],
      activeGames: [{ court_id: 'c1' }],
      courts: [{ id: 'c1' }],
    })
    await processWaitingEntries()
    expect(finalizeBooking).not.toHaveBeenCalled()
  })
})
