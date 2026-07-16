import { describe, it, expect, vi, beforeEach } from 'vitest'

// Faithful-ish in-memory fake of the subset of supabase/PostgREST used by the
// queue code, to reproduce the "queue not advancing / court stays busy" bug end-to-end.

vi.mock('@/lib/mqtt', () => ({ publishDisplay: vi.fn() }))
vi.mock('@/lib/display/sports-caster', () => ({ generatePayload: vi.fn(() => ({})) }))

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
      or: (expr: string) => {
        // supports "court_id.eq.X,court_id.is.null"
        const parts = expr.split(',').map(p => p.trim())
        filters.push(r => parts.some(p => {
          const [col, op, ...rest] = p.split('.')
          const v = rest.join('.')
          if (op === 'eq') return String(r[col]) === v
          if (op === 'is' && v === 'null') return r[col] === null || r[col] === undefined
          return false
        }))
        return api
      },
      order: (key: string, opts?: any) => { orderKey = key; orderAsc = opts?.ascending ?? true; return runMaybe() },
      limit: () => api,
      maybeSingle: () => runSingle(),
      single: () => runSingle(),
      then: (resolve: any) => resolve(runList()),
    }

    function matched() {
      let rows = (tables[table] ?? []).filter(r => filters.every(f => f(r)))
      if (orderKey) rows = [...rows].sort((a, b) => {
        const av = a[orderKey!], bv = b[orderKey!]
        return (av < bv ? -1 : av > bv ? 1 : 0) * (orderAsc ? 1 : -1)
      })
      return rows
    }

    function applyUpdate() {
      const rows = matched()
      rows.forEach(r => Object.assign(r, pendingUpdate))
      return rows
    }

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
    function runMaybe() { return api }
    return api
  }

  return {
    from: (t: string) => query(t),
    rpc: vi.fn(async (_name: string, args: any) => {
      // emulate register_game: create In Progress game + set court In Game
      const court = (tables.courts ?? []).find(c => c.name === args.p_court_name)
      if (!court) return { data: null, error: { message: 'Court not found' } }
      const gameId = `game-${(tables.games?.length ?? 0) + 1}`
      tables.games = tables.games ?? []
      tables.games.push({ id: gameId, court_id: court.id, match_type: args.p_match_type, duration: args.p_duration, status: 'In Progress', start_time: new Date().toISOString(), created_at: new Date().toISOString() })
      court.status = 'In Game'
      return { data: gameId, error: null }
    }),
  }
}

describe('REGRESSION: queue advances / courts free correctly', () => {
  beforeEach(() => vi.resetModules())

  it('assigns the waiting player to the court once the active game expires', async () => {
    const now = Date.now()
    const tables: Record<string, Row[]> = {
      settings: [
        { key: 'preparationTime', value: '300' },
        { key: 'prices', value: '{"30":150,"60":300,"90":450}' },
      ],
      courts: [{ id: 'c1', name: 'Court 1', status: 'In Game' }],
      // A game that started 70 minutes ago for 60 min => already expired
      games: [{ id: 'g1', court_id: 'c1', duration: 60, status: 'In Progress', start_time: new Date(now - 70 * 60_000).toISOString(), created_at: new Date(now - 70 * 60_000).toISOString() }],
      // One person waiting, WITH a court preference for the busy court (as the kiosk sends)
      queue_entries: [{ id: 'qe-1', member_id: 'm1', court_id: 'c1', duration: 60, party_size: 2, player_ids: JSON.stringify(['m1']), status: 'waiting', requested_start: new Date(now).toISOString(), created_at: new Date(now - 5 * 60_000).toISOString(), match_title: null, expires_at: null }],
      members: [{ id: 'm1', status: 'Active' }],
      rfid_cards: [{ uid: 'UID1', member_id: 'm1', status: 'Active' }],
    }

    const db = makeFakeDb(tables)
    vi.doMock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => db) }))

    const { processExpiredGames } = await import('./queue-processor')
    await processExpiredGames()

    const g1 = tables.games.find(g => g.id === 'g1')!
    const waiter = tables.queue_entries.find(q => q.id === 'qe-1')!
    const newGame = tables.games.find(g => g.id !== 'g1')

    console.log('g1.status =', g1.status)
    console.log('court.status =', tables.courts[0].status)
    console.log('waiter.status =', waiter.status, 'court_id =', waiter.court_id)
    console.log('newGame =', newGame?.id, newGame?.status)

    expect(g1.status).toBe('Completed')          // old game closed
    expect(waiter.status).toBe('completed')       // waiter got booked
    expect(newGame).toBeTruthy()                   // a new game was created
    expect(tables.courts[0].status).toBe('In Game')
  })

  it('does NOT double-book a court that has a Scheduled (not yet started) game', async () => {
    const now = Date.now()
    const tables: Record<string, Row[]> = {
      settings: [
        { key: 'preparationTime', value: '300' },
        { key: 'prices', value: '{"30":150,"60":300,"90":450}' },
      ],
      courts: [
        { id: 'c1', name: 'Court 1', status: 'In Game' },
        { id: 'c2', name: 'Court 2', status: 'Scheduled' },
      ],
      games: [
        // c1 game expired -> will complete and free c1
        { id: 'g1', court_id: 'c1', duration: 60, status: 'In Progress', start_time: new Date(now - 70 * 60_000).toISOString(), created_at: new Date(now - 70 * 60_000).toISOString() },
        // c2 has a Scheduled game starting soon -> c2 is NOT free
        { id: 'g2', court_id: 'c2', duration: 60, status: 'Scheduled', start_time: new Date(now + 5 * 60_000).toISOString(), created_at: new Date(now - 1 * 60_000).toISOString() },
      ],
      queue_entries: [
        { id: 'qe-1', member_id: 'm1', court_id: null, duration: 60, party_size: 2, player_ids: JSON.stringify(['m1']), status: 'waiting', requested_start: new Date(now).toISOString(), created_at: new Date(now - 5 * 60_000).toISOString(), match_title: null, expires_at: null },
        { id: 'qe-2', member_id: 'm2', court_id: null, duration: 60, party_size: 2, player_ids: JSON.stringify(['m2']), status: 'waiting', requested_start: new Date(now).toISOString(), created_at: new Date(now - 4 * 60_000).toISOString(), match_title: null, expires_at: null },
      ],
      members: [{ id: 'm1', status: 'Active' }, { id: 'm2', status: 'Active' }],
      rfid_cards: [{ uid: 'UID1', member_id: 'm1', status: 'Active' }, { uid: 'UID2', member_id: 'm2', status: 'Active' }],
    }

    const db = makeFakeDb(tables)
    vi.doMock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => db) }))

    const { processExpiredGames } = await import('./queue-processor')
    await processExpiredGames()

    // Count how many NEW games got created on c2 (should be ZERO; only 1 on c1)
    const c2Games = tables.games.filter(g => g.court_id === 'c2')
    const c1NewGames = tables.games.filter(g => g.court_id === 'c1' && g.id !== 'g1')
    console.log('c2 games:', c2Games.map(g => `${g.id}:${g.status}`))
    console.log('c1 new games:', c1NewGames.map(g => `${g.id}:${g.status}`))

    // c2 must still have only its original Scheduled game (no double-book)
    expect(c2Games.length).toBe(1)
    expect(c2Games[0].id).toBe('g2')
  })

  it('processCourt advances a waiter who prefers a DIFFERENT free court', async () => {
    const now = Date.now()
    const tables: Record<string, Row[]> = {
      settings: [
        { key: 'preparationTime', value: '300' },
        { key: 'prices', value: '{"30":150,"60":300,"90":450}' },
      ],
      courts: [
        { id: 'c1', name: 'Court 1', status: 'Available' },
        { id: 'c2', name: 'Court 2', status: 'Available' }, // free!
      ],
      games: [],
      // Waiter prefers c2 (which is free). An unrelated event triggers processCourt('c1').
      queue_entries: [
        { id: 'qe-1', member_id: 'm1', court_id: 'c2', duration: 60, party_size: 2, player_ids: JSON.stringify(['m1']), status: 'waiting', requested_start: new Date(now).toISOString(), created_at: new Date(now - 5 * 60_000).toISOString(), match_title: null, expires_at: null },
      ],
      members: [{ id: 'm1', status: 'Active' }],
      rfid_cards: [{ uid: 'UID1', member_id: 'm1', status: 'Active' }],
    }

    const db = makeFakeDb(tables)
    vi.doMock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => db) }))

    // Simulate the decline-offer path which calls ONLY processCourt(courtId)
    const { processCourt } = await import('./queue-processor')
    await processCourt('c1')

    const waiter = tables.queue_entries.find(q => q.id === 'qe-1')!
    console.log('after processCourt(c1): waiter.status =', waiter.status)
    // The c2-preferring waiter should have been booked onto the free c2,
    // but processCourt('c1') never considers them.
    expect(waiter.status).toBe('completed')
  })


})
