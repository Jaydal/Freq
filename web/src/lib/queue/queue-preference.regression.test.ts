import { describe, it, expect, vi, beforeEach } from 'vitest'

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
    let pendingOr: ((r: Row) => boolean) | null = null

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
        const parts = expr.split(',').map(p => p.trim())
        pendingOr = (r: Row) => parts.some(p => {
          const [col, op, ...rest] = p.split('.')
          const v = rest.join('.')
          if (op === 'eq') return String(r[col]) === v
          if (op === 'is' && v === 'null') return r[col] === null || r[col] === undefined
          return false
        })
        return api
      },
      order: () => api,
      limit: () => api,
      maybeSingle: () => runSingle(),
      single: () => runSingle(),
      then: (resolve: any) => resolve(runList()),
    }

    function matched() {
      let rows = (tables[table] ?? []).filter(r => filters.every(f => f(r)))
      if (pendingOr) rows = rows.filter(pendingOr)
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
    return api
  }

  return {
    from: (t: string) => query(t),
    rpc: vi.fn(async (_name: string, args: any) => {
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

describe('REGRESSION: court-preference respected by processWaitingEntries', () => {
  beforeEach(() => vi.resetModules())

  it('keeps a court-1-preferring waiter in the waiting list when only court 3 is free', async () => {
    const now = Date.now()
    const tables: Record<string, Row[]> = {
      settings: [
        { key: 'preparationTime', value: '300' },
        { key: 'prices', value: '{"30":150,"60":300,"90":450}' },
      ],
      courts: [
        { id: 'c1', name: 'Court 1', status: 'In Game' },   // busy
        { id: 'c2', name: 'Court 2', status: 'In Game' },   // busy
        { id: 'c3', name: 'Court 3', status: 'Available' },  // free
      ],
      games: [
        { id: 'g1', court_id: 'c1', duration: 60, status: 'In Progress', start_time: new Date(now - 10 * 60_000).toISOString() },
        { id: 'g2', court_id: 'c2', duration: 60, status: 'In Progress', start_time: new Date(now - 10 * 60_000).toISOString() },
      ],
      // User explicitly booked COURT 1 (busy) -> should wait for court 1
      queue_entries: [{ id: 'qe-1', member_id: 'm1', court_id: 'c1', duration: 60, party_size: 2, player_ids: JSON.stringify(['m1']), status: 'waiting', requested_start: new Date(now).toISOString(), created_at: new Date(now - 1 * 60_000).toISOString(), match_title: null, expires_at: null }],
      members: [{ id: 'm1', status: 'Active' }],
      rfid_cards: [{ uid: 'UID1', member_id: 'm1', status: 'Active' }],
    }

    const db = makeFakeDb(tables)
    vi.doMock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => db) }))

    const { processWaitingEntries } = await import('./queue-processor')
    await processWaitingEntries()

    const waiter = tables.queue_entries.find(q => q.id === 'qe-1')!
    const newGame = (tables.games ?? []).find(g => g.id !== 'g1' && g.id !== 'g2')

    console.log('waiter.status =', waiter.status, 'court_id =', waiter.court_id)
    console.log('newGame =', newGame?.id, 'on court', newGame?.court_id)

    // A waiter who chose the BUSY court 1 must stay waiting (for court 1),
    // NOT be auto-shoved onto the free court 3.
    expect(waiter.status).toBe('waiting')
    expect(newGame).toBeUndefined()
  })
})
