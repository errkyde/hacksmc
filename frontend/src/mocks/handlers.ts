import { http, HttpResponse, delay } from 'msw'
import { db, type MockNatRule } from './data'

const DELAY = 300

// ── Helpers ───────────────────────────────────────────────────────────────────

function getUsernameFromRequest(request: Request): string {
  try {
    const auth = request.headers.get('Authorization') ?? ''
    const token = auth.replace('Bearer ', '')
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    return JSON.parse(atob(padded)).sub ?? ''
  } catch {
    return ''
  }
}

function hostToDto(hostId: number) {
  const host = db.hosts.find(h => h.id === hostId)!
  const policy = db.policies.find(p => p.hostId === hostId)
  return {
    id: host.id,
    name: host.name,
    ipAddress: host.ipAddress,
    description: host.description,
    policy: policy
      ? { id: policy.id, allowedProtocols: policy.allowedProtocols, portRangeMin: policy.portRangeMin, portRangeMax: policy.portRangeMax, maxRules: policy.maxRules }
      : null,
  }
}

// ── Handlers ──────────────────────────────────────────────────────────────────

export const handlers = [

  // ── Auth ───────────────────────────────────────────────────────────────────
  http.post('/api/auth/login', async ({ request }) => {
    await delay(DELAY)
    const body = await request.json() as { username: string; password: string }
    const user = db.users.find(u => u.username === body.username)

    if (!user || user.password !== body.password) {
      return HttpResponse.json({ detail: 'Invalid credentials' }, { status: 401 })
    }

    const payload = btoa(JSON.stringify({ sub: user.username, role: user.role, exp: 9999999999 }))
    const fakeToken = `eyJhbGciOiJIUzI1NiJ9.${payload}.mock-signature`
    return HttpResponse.json({ token: fakeToken, username: user.username, role: user.role })
  }),

  // ── Hosts (user-scoped) ────────────────────────────────────────────────────
  http.get('/api/hosts', async ({ request }) => {
    await delay(DELAY)
    const username = getUsernameFromRequest(request)
    const user = db.users.find(u => u.username === username)
    if (!user) return HttpResponse.json([])
    return HttpResponse.json(
      db.hosts
        .filter(h => h.userId === user.id)
        .map(h => ({ id: h.id, name: h.name, ipAddress: h.ipAddress, description: h.description }))
    )
  }),

  // ── Policies (user-scoped) ─────────────────────────────────────────────────
  http.get('/api/policies', async ({ request }) => {
    await delay(DELAY)
    const username = getUsernameFromRequest(request)
    const user = db.users.find(u => u.username === username)
    if (!user) return HttpResponse.json([])
    const userHostIds = db.hosts.filter(h => h.userId === user.id).map(h => h.id)
    return HttpResponse.json(
      db.policies
        .filter(p => userHostIds.includes(p.hostId))
        .map(p => {
          const host = db.hosts.find(h => h.id === p.hostId)!
          return { ...p, host: { id: host.id, name: host.name, ipAddress: host.ipAddress } }
        })
    )
  }),

  // ── NAT Rules (user-scoped) ────────────────────────────────────────────────
  http.get('/api/nat/rules', async ({ request }) => {
    await delay(DELAY)
    const username = getUsernameFromRequest(request)
    const user = db.users.find(u => u.username === username)
    if (!user) return HttpResponse.json([])
    return HttpResponse.json(db.natRules.filter(r => r.userId === user.id))
  }),

  http.post('/api/nat/rules', async ({ request }) => {
    await delay(DELAY * 2)
    const username = getUsernameFromRequest(request)
    const user = db.users.find(u => u.username === username)
    if (!user) return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as { hostId: number; protocol: string; port: number; description?: string }
    const host = db.hosts.find(h => h.id === body.hostId && h.userId === user.id)
    if (!host) return HttpResponse.json({ detail: 'Host not found or not owned by user' }, { status: 404 })

    const policy = db.policies.find(p => p.hostId === body.hostId)
    if (policy) {
      const allowed = policy.allowedProtocols.split(',').map(s => s.trim().toUpperCase())
      if (!allowed.includes(body.protocol.toUpperCase())) {
        return HttpResponse.json(
          { detail: `Protocol '${body.protocol}' not allowed for host: ${host.name}. Allowed: ${policy.allowedProtocols}` },
          { status: 403 }
        )
      }
      if (body.port < policy.portRangeMin || body.port > policy.portRangeMax) {
        return HttpResponse.json(
          { detail: `Port ${body.port} outside allowed range [${policy.portRangeMin}-${policy.portRangeMax}]` },
          { status: 403 }
        )
      }
      const activeCount = db.natRules.filter(r => r.host.id === body.hostId && r.status === 'ACTIVE').length
      if (activeCount >= policy.maxRules) {
        return HttpResponse.json(
          { detail: `Max rule limit (${policy.maxRules}) reached for host: ${host.name}` },
          { status: 403 }
        )
      }
    }

    // Global port conflict check — port must be free across all users
    const portInUse = db.natRules.some(
      r => r.port === body.port && (r.status === 'ACTIVE' || r.status === 'PENDING')
    )
    if (portInUse) {
      return HttpResponse.json(
        { detail: `Port ${body.port} is already in use by another rule` },
        { status: 403 }
      )
    }

    const newRule: MockNatRule = {
      id: db.nextId++,
      userId: user.id,
      host: { id: host.id, name: host.name, ipAddress: host.ipAddress },
      protocol: body.protocol.toUpperCase(),
      port: body.port,
      description: body.description ?? null,
      pfSenseRuleId: `pf-rule-mock-${db.nextId}`,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      deletedAt: null,
    }
    db.natRules = [...db.natRules, newRule]
    return HttpResponse.json(newRule, { status: 201 })
  }),

  http.delete('/api/nat/rules/:id', async ({ params, request }) => {
    await delay(DELAY * 2)
    const username = getUsernameFromRequest(request)
    const user = db.users.find(u => u.username === username)
    const id = Number(params.id)
    const rule = db.natRules.find(r => r.id === id && r.userId === user?.id)
    if (!rule) return HttpResponse.json({ detail: 'Rule not found' }, { status: 404 })
    db.natRules = db.natRules.map(r =>
      r.id === id ? { ...r, status: 'DELETED' as const, deletedAt: new Date().toISOString() } : r
    )
    return new HttpResponse(null, { status: 204 })
  }),

  // ── Auth: Change password ─────────────────────────────────────────────────
  http.post('/api/auth/change-password', async ({ request }) => {
    await delay(DELAY)
    const username = getUsernameFromRequest(request)
    const user = db.users.find(u => u.username === username)
    const body = await request.json() as { currentPassword: string; newPassword: string }
    if (!user || user.password !== body.currentPassword) {
      return HttpResponse.json({ detail: 'Aktuelles Passwort ist falsch' }, { status: 400 })
    }
    user.password = body.newPassword
    return new HttpResponse(null, { status: 204 })
  }),

  // ── Admin: Users ───────────────────────────────────────────────────────────
  http.get('/api/admin/users', async () => {
    await delay(DELAY)
    return HttpResponse.json(
      db.users.map(u => ({
        id: u.id,
        username: u.username,
        role: u.role,
        hostCount: db.hosts.filter(h => h.userId === u.id).length,
      }))
    )
  }),

  http.post('/api/admin/users', async ({ request }) => {
    await delay(DELAY)
    const body = await request.json() as { username: string; password: string; role: 'USER' | 'ADMIN' }
    if (db.users.find(u => u.username === body.username)) {
      return HttpResponse.json({ detail: 'Username already exists' }, { status: 409 })
    }
    const newUser = { id: db.nextId++, username: body.username, role: body.role ?? 'USER', password: body.password }
    db.users = [...db.users, newUser]
    return HttpResponse.json({ id: newUser.id, username: newUser.username, role: newUser.role, hostCount: 0 }, { status: 201 })
  }),

  http.delete('/api/admin/users/:id', async ({ params }) => {
    await delay(DELAY)
    const id = Number(params.id)
    if (!db.users.find(u => u.id === id)) {
      return HttpResponse.json({ detail: 'User not found' }, { status: 404 })
    }
    db.users = db.users.filter(u => u.id !== id)
    const removedHostIds = db.hosts.filter(h => h.userId === id).map(h => h.id)
    db.hosts = db.hosts.filter(h => h.userId !== id)
    db.policies = db.policies.filter(p => !removedHostIds.includes(p.hostId))
    db.natRules = db.natRules.filter(r => r.userId !== id)
    return new HttpResponse(null, { status: 204 })
  }),

  // ── Admin: Hosts ───────────────────────────────────────────────────────────
  http.get('/api/admin/users/:id/hosts', async ({ params }) => {
    await delay(DELAY)
    const userId = Number(params.id)
    if (!db.users.find(u => u.id === userId)) {
      return HttpResponse.json({ detail: 'User not found' }, { status: 404 })
    }
    return HttpResponse.json(db.hosts.filter(h => h.userId === userId).map(h => hostToDto(h.id)))
  }),

  http.post('/api/admin/users/:id/hosts', async ({ params, request }) => {
    await delay(DELAY)
    const userId = Number(params.id)
    if (!db.users.find(u => u.id === userId)) {
      return HttpResponse.json({ detail: 'User not found' }, { status: 404 })
    }
    const body = await request.json() as {
      name: string; ipAddress: string; description?: string
      allowedProtocols: string; portRangeMin: number; portRangeMax: number; maxRules: number
    }
    if (body.portRangeMin > body.portRangeMax) {
      return HttpResponse.json({ detail: 'portRangeMin must be ≤ portRangeMax' }, { status: 400 })
    }
    const hostId = db.nextId++
    db.hosts = [...db.hosts, { id: hostId, userId, name: body.name, ipAddress: body.ipAddress, description: body.description ?? null }]
    db.policies = [...db.policies, { id: db.nextId++, hostId, allowedProtocols: body.allowedProtocols, portRangeMin: body.portRangeMin, portRangeMax: body.portRangeMax, maxRules: body.maxRules }]
    return HttpResponse.json(hostToDto(hostId), { status: 201 })
  }),

  http.delete('/api/admin/hosts/:hostId', async ({ params }) => {
    await delay(DELAY)
    const hostId = Number(params.hostId)
    if (!db.hosts.find(h => h.id === hostId)) {
      return HttpResponse.json({ detail: 'Host not found' }, { status: 404 })
    }
    db.hosts = db.hosts.filter(h => h.id !== hostId)
    db.policies = db.policies.filter(p => p.hostId !== hostId)
    db.natRules = db.natRules.filter(r => r.host.id !== hostId)
    return new HttpResponse(null, { status: 204 })
  }),

  // ── Admin: Policy ──────────────────────────────────────────────────────────
  http.put('/api/admin/hosts/:hostId/policy', async ({ params, request }) => {
    await delay(DELAY)
    const hostId = Number(params.hostId)
    const policy = db.policies.find(p => p.hostId === hostId)
    if (!policy) return HttpResponse.json({ detail: 'Policy not found' }, { status: 404 })
    const body = await request.json() as { allowedProtocols: string; portRangeMin: number; portRangeMax: number; maxRules: number }
    if (body.portRangeMin > body.portRangeMax) {
      return HttpResponse.json({ detail: 'portRangeMin must be ≤ portRangeMax' }, { status: 400 })
    }
    Object.assign(policy, body)
    return HttpResponse.json({ id: policy.id, allowedProtocols: policy.allowedProtocols, portRangeMin: policy.portRangeMin, portRangeMax: policy.portRangeMax, maxRules: policy.maxRules })
  }),
]
