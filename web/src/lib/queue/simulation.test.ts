import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/mqtt', () => ({ publishDisplay: vi.fn() }))
vi.mock('@/lib/display/sports-caster', () => ({ generatePayload: vi.fn(() => ({})) }))
vi.mock('./booking-engine', () => ({ findAvailableCourt: vi.fn(), isSlotAvailable: vi.fn() }))

type Row = Record<string, any>

function makeFakeDb(tables: Record<string, Row[]>) {
  function query(table: string) {
    const filters: Array<(r: Row) => boolean> = []
    let orderKey: string | null = null
    let orderAsc = true
    let pendingUpdate: Row | null = null
    let mode: 'select' | 'update' = 'select'
    let selectCount = false

    const api: any = {
      select: (_c?: string, opts?: any) => { if (opts?.head) selectCount = true; return api },
      insert: (payload: Row | Row[]) => {
        const rows = Array.isArray(payload) ? payload : [payload]
        rows.forEach(r => {
          const row = { id: r.id ?? `${table}-${(tables[table]?.length ?? 0) + 1}`, created_at: r.created_at ?? new Date().toISOString(), ...r }
          tables[table] = tables[table] ?? []
          tables[table].push(row)
        })
        api._inserted = rows
        return api
      },
      update: (payload: Row) => { mode = 'update'; pendingUpdate = payload; return api },
      eq: (col: string, val: any) => { filters.push(r => r[col] === val); return api },
      lt: (col: string, val: any) => { filters.push(r => r[col] < val); return api },
      gte: (col: string, val: any) => { filters.push(r => r[col] >= val); return api },
      in: (col: string, vals: any[]) => { filters.push(r => vals.includes(r[col])); return api },
      or: () => api,
      order: () => api,
      limit: () => api,
      maybeSingle: () => runSingle(),
      single: () => runSingle(),
      then: (resolve: any) => resolve(runList()),
    }
    function matched() {
      let rows = (tables[table] ?? []).filter(r => filters.every(f => f(r)))
      if (orderKey) rows = [...rows].sort((a, b) => (a[orderKey!] < b[orderKey!] ? -1 : a[orderKey!] > b[orderKey!] ? 1 : 0) * (orderAsc ? 1 : -1))
      return rows
    }
    function applyUpdate() { const rows = matched(); rows.forEach(r => Object.assign(r, pendingUpdate)); return rows }
    function runList() {
      if (mode === 'update') { const rows = applyUpdate(); return Promise.resolve({ data: rows, error: null }) }
      if (selectCount) return Promise.resolve({ count: matched().length, error: null })
      if (api._inserted) return Promise.resolve({ data: api._inserted, error: null })
      return Promise.resolve({ data: matched(), error: null })
    }
    function runSingle() {
      if (mode === 'update') { const rows = applyUpdate(); return Promise.resolve({ data: rows[0] ?? null, error: null }) }
      if (api._inserted) return Promise.resolve({ data: api._inserted[0] ?? null, error: null })
      const rows = matched()
      return Promise.resolve({ data: rows[0] ?? null, error: null })
    }
    return api
  }
  return {
    from: (t: string) => query(t),
    rpc: vi.fn(async (_name: string, args: any) => {
      const court = (tables.courts ?? []).find(c => c.name === args.p_court_name)
      if (!court) return { data: null, error: { message: 'Court not found' } }
      const gameId = `game-${(tables.games?.length ?? 0) + 1}`
      tables.games = tables.games ?? []
      tables.games.push({
        id: gameId, court_id: court.id, match_type: args.p_match_type,
        duration: args.p_duration, status: 'In Progress',
        start_time: new Date().toISOString(), created_at: new Date().toISOString(),
      })
      court.status = 'In Game'
      return { data: gameId, error: null }
    }),
  }
}

describe('Booking simulation', () => {
  beforeEach(() => vi.resetModules())

  it('Per court: books immediately when the chosen court is free', async () => {
    const tables: Record<string, Row[]> = {
      settings: [{ key: 'preparationTime', value: '300' }, { key: 'prices', value: '{"30":150,"60":300,"90":450}' }],
      courts: [{ id: 'c1', name: 'Court 1', status: 'Available' }],
      games: [],
      queue_entries: [],
      members: [{ id: 'm1', status: 'Active' }],
      rfid_cards: [{ uid: 'UID1', member_id: 'm1', status: 'Active' }],
      wallets: [{ id: 'w1', member_id: 'm1', balance: 1000 }],
      wallet_transactions: [],
    }
    const db = makeFakeDb(tables)
    vi.doMock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => db) }))
    vi.mocked((await import('./booking-engine')).isSlotAvailable).mockResolvedValue(true)

    const { joinQueue } = await import('./queue-service')
    const result = await joinQueue({ memberId: 'm1', start: new Date(), duration: 60, partySize: 2, playerIds: ['m1'], courtId: 'c1' })

    expect(result.status).toBe('completed')
    expect(result.court_id).toBe('c1')
    expect(tables.games.length).toBe(1)
  })

  it('Per court: joins waiting list when the chosen court has an active game', async () => {
    const now = Date.now()
    const tables: Record<string, Row[]> = {
      settings: [{ key: 'preparationTime', value: '300' }, { key: 'prices', value: '{"30":150,"60":300,"90":450}' }],
      courts: [{ id: 'c1', name: 'Court 1', status: 'In Game' }],
      games: [{ id: 'g1', court_id: 'c1', duration: 60, status: 'In Progress', start_time: new Date(now - 10 * 60_000).toISOString(), created_at: new Date(now - 10 * 60_000).toISOString() }],
      queue_entries: [],
      members: [{ id: 'm1', status: 'Active' }],
      rfid_cards: [{ uid: 'UID1', member_id: 'm1', status: 'Active' }],
      wallets: [{ id: 'w1', member_id: 'm1', balance: 1000 }],
      wallet_transactions: [],
    }
    const db = makeFakeDb(tables)
    vi.doMock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => db) }))
    vi.mocked((await import('./booking-engine')).isSlotAvailable).mockResolvedValue(false)

    const { joinQueue } = await import('./queue-service')
    const result = await joinQueue({ memberId: 'm1', start: new Date(), duration: 60, partySize: 2, playerIds: ['m1'], courtId: 'c1' })

    expect(result.status).toBe('waiting')
    expect(tables.queue_entries.length).toBe(1)
  })

  it('Any court: books immediately when a free court exists', async () => {
    const now = Date.now()
    const tables: Record<string, Row[]> = {
      settings: [{ key: 'preparationTime', value: '300' }, { key: 'prices', value: '{"30":150,"60":300,"90":450}' }],
      courts: [
        { id: 'c1', name: 'Court 1', status: 'In Game' },
        { id: 'c2', name: 'Court 2', status: 'Available' },
      ],
      games: [{ id: 'g1', court_id: 'c1', duration: 60, status: 'In Progress', start_time: new Date(now - 10 * 60_000).toISOString(), created_at: new Date(now - 10 * 60_000).toISOString() }],
      queue_entries: [],
      members: [{ id: 'm2', status: 'Active' }],
      rfid_cards: [{ uid: 'UID2', member_id: 'm2', status: 'Active' }],
      wallets: [{ id: 'w2', member_id: 'm2', balance: 1000 }],
      wallet_transactions: [],
    }
    const db = makeFakeDb(tables)
    vi.doMock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => db) }))
    const { findAvailableCourt, isSlotAvailable } = await import('./booking-engine')
    vi.mocked(findAvailableCourt).mockResolvedValue({ id: 'c2', name: 'Court 2', status: 'Available' })
    vi.mocked(isSlotAvailable).mockResolvedValue(true)

    const { joinQueue } = await import('./queue-service')
    const result = await joinQueue({ memberId: 'm2', start: new Date(), duration: 60, partySize: 2, playerIds: ['m2'] })

    expect(result.status).toBe('completed')
    expect(result.court_id).toBe('c2')
    expect(tables.games.length).toBe(2)
  })

  it('Any court: joins waiting list when all courts are busy', async () => {
    const now = Date.now()
    const tables: Record<string, Row[]> = {
      settings: [{ key: 'preparationTime', value: '300' }, { key: 'prices', value: '{"30":150,"60":300,"90":450}' }],
      courts: [
        { id: 'c1', name: 'Court 1', status: 'In Game' },
        { id: 'c2', name: 'Court 2', status: 'In Game' },
      ],
      games: [
        { id: 'g1', court_id: 'c1', duration: 60, status: 'In Progress', start_time: new Date(now - 10 * 60_000).toISOString(), created_at: new Date(now - 10 * 60_000).toISOString() },
        { id: 'g2', court_id: 'c2', duration: 60, status: 'In Progress', start_time: new Date(now - 10 * 60_000).toISOString(), created_at: new Date(now - 10 * 60_000).toISOString() },
      ],
      queue_entries: [],
      members: [{ id: 'm3', status: 'Active' }],
      rfid_cards: [{ uid: 'UID3', member_id: 'm3', status: 'Active' }],
      wallets: [{ id: 'w3', member_id: 'm3', balance: 1000 }],
      wallet_transactions: [],
    }
    const db = makeFakeDb(tables)
    vi.doMock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => db) }))
    vi.mocked((await import('./booking-engine')).findAvailableCourt).mockResolvedValue(null)

    const { joinQueue } = await import('./queue-service')
    const result = await joinQueue({ memberId: 'm3', start: new Date(), duration: 60, partySize: 2, playerIds: ['m3'] })

    expect(result.status).toBe('waiting')
    expect(tables.queue_entries.length).toBe(1)
  })

  it('Two busy courts: book court 1 -> waiting, book court 3 -> active immediately', async () => {
    const now = Date.now()
    const tables: Record<string, Row[]> = {
      settings: [{ key: 'preparationTime', value: '300' }, { key: 'prices', value: '{"30":150,"60":300,"90":450}' }],
      courts: [
        { id: 'c1', name: 'Court 1', status: 'In Game' },
        { id: 'c2', name: 'Court 2', status: 'In Game' },
        { id: 'c3', name: 'Court 3', status: 'Available' },
      ],
      games: [
        { id: 'g1', court_id: 'c1', duration: 60, status: 'In Progress', start_time: new Date(now - 10 * 60_000).toISOString(), created_at: new Date(now - 10 * 60_000).toISOString() },
        { id: 'g2', court_id: 'c2', duration: 60, status: 'In Progress', start_time: new Date(now - 10 * 60_000).toISOString(), created_at: new Date(now - 10 * 60_000).toISOString() },
      ],
      queue_entries: [],
      members: [{ id: 'm1', status: 'Active' }, { id: 'm2', status: 'Active' }],
      rfid_cards: [{ uid: 'UID1', member_id: 'm1', status: 'Active' }, { uid: 'UID2', member_id: 'm2', status: 'Active' }],
      wallets: [{ id: 'w1', member_id: 'm1', balance: 1000 }, { id: 'w2', member_id: 'm2', balance: 1000 }],
      wallet_transactions: [],
    }
    const db = makeFakeDb(tables)
    vi.doMock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => db) }))
    const { isSlotAvailable } = await import('./booking-engine')
    vi.mocked(isSlotAvailable).mockImplementation(async (courtId: string) => courtId === 'c3')

    const { joinQueue } = await import('./queue-service')

    const r1 = await joinQueue({ memberId: 'm1', start: new Date(), duration: 60, partySize: 2, playerIds: ['m1'], courtId: 'c1' })
    expect(r1.status).toBe('waiting')

    const r2 = await joinQueue({ memberId: 'm2', start: new Date(), duration: 60, partySize: 2, playerIds: ['m2'], courtId: 'c3' })
    expect(r2.status).toBe('completed')
    expect(r2.court_id).toBe('c3')
    expect(tables.queue_entries.length).toBe(1)
    expect(tables.games.length).toBe(3)
    expect(tables.games[2].court_id).toBe('c3')
  })

  it('Same court: cannot double-book when a Scheduled game already exists for that slot', async () => {
    const now = Date.now()
    const tables: Record<string, Row[]> = {
      settings: [{ key: 'preparationTime', value: '300' }, { key: 'prices', value: '{"30":150,"60":300,"90":450}' }],
      courts: [{ id: 'c1', name: 'Court 1', status: 'Available' }],
      games: [{
        id: 'g1', court_id: 'c1', duration: 60, status: 'Scheduled',
        start_time: new Date(now + 5 * 60_000).toISOString(),
        created_at: new Date(now - 60 * 60_000).toISOString(),
      }],
      queue_entries: [],
      members: [{ id: 'm1', status: 'Active' }],
      rfid_cards: [{ uid: 'UID1', member_id: 'm1', status: 'Active' }],
      wallets: [{ id: 'w1', member_id: 'm1', balance: 1000 }],
      wallet_transactions: [],
    }
    const db = makeFakeDb(tables)
    vi.doMock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => db) }))
    vi.mocked((await import('./booking-engine')).isSlotAvailable).mockResolvedValue(false)

    const { joinQueue } = await import('./queue-service')
    const result = await joinQueue({ memberId: 'm1', start: new Date(), duration: 60, partySize: 2, playerIds: ['m1'], courtId: 'c1' })

    expect(result.status).toBe('waiting')
    expect(tables.games.length).toBe(1)
  })

  it('Any court: skips courts with Scheduled future games', async () => {
    const now = Date.now()
    const tables: Record<string, Row[]> = {
      settings: [{ key: 'preparationTime', value: '300' }, { key: 'prices', value: '{"30":150,"60":300,"90":450}' }],
      courts: [{ id: 'c1', name: 'Court 1', status: 'Available' }],
      games: [{
        id: 'g1', court_id: 'c1', duration: 60, status: 'Scheduled',
        start_time: new Date(now + 5 * 60_000).toISOString(),
        created_at: new Date(now - 60 * 60_000).toISOString(),
      }],
      queue_entries: [],
      members: [{ id: 'm1', status: 'Active' }],
      rfid_cards: [{ uid: 'UID1', member_id: 'm1', status: 'Active' }],
      wallets: [{ id: 'w1', member_id: 'm1', balance: 1000 }],
      wallet_transactions: [],
    }
    const db = makeFakeDb(tables)
    vi.doMock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => db) }))
    vi.mocked((await import('./booking-engine')).findAvailableCourt).mockResolvedValue(null)

    const { joinQueue } = await import('./queue-service')
    const result = await joinQueue({ memberId: 'm1', start: new Date(), duration: 60, partySize: 2, playerIds: ['m1'] })

    expect(result.status).toBe('waiting')
  })
})
