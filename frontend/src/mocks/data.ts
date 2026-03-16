// Mock data matching V2 + V3 seed migrations

export interface MockUser {
  id: number
  username: string
  role: 'USER' | 'ADMIN'
  password: string
}

export interface MockHost {
  id: number
  userId: number
  name: string
  ipAddress: string
  description: string | null
}

export interface MockPolicy {
  id: number
  hostId: number
  allowedProtocols: string
  portRangeMin: number
  portRangeMax: number
  maxRules: number
}

export interface MockNatRule {
  id: number
  userId: number
  host: { id: number; name: string; ipAddress: string }
  protocol: string
  portStart: number
  portEnd: number
  description: string | null
  pfSenseRuleId: string | null
  status: 'PENDING' | 'ACTIVE' | 'DELETED'
  createdAt: string
  deletedAt: string | null
}

// Mutable state — all handlers read/write through this object
export const db = {
  nextId: 100,

  users: [
    { id: 1, username: 'admin', role: 'ADMIN', password: 'admin' },
    { id: 2, username: 'phil',  role: 'USER',  password: 'admin' },
    { id: 3, username: 'lisa',  role: 'USER',  password: 'admin' },
    { id: 4, username: 'felix', role: 'USER',  password: 'admin' },
    { id: 5, username: 'sarah', role: 'USER',  password: 'admin' },
  ] as MockUser[],

  hosts: [
    { id: 1, userId: 2, name: 'minecraft-server', ipAddress: '192.168.10.50', description: 'Minecraft game server' },
    { id: 2, userId: 2, name: 'teamspeak-server', ipAddress: '192.168.10.51', description: 'TeamSpeak voice server' },
    { id: 3, userId: 3, name: 'web-server',       ipAddress: '192.168.20.10', description: 'Nginx web server' },
    { id: 4, userId: 3, name: 'vpn-gateway',      ipAddress: '192.168.20.11', description: 'WireGuard VPN endpoint' },
    { id: 5, userId: 4, name: 'dev-server',       ipAddress: '192.168.30.5',  description: 'Development & staging server' },
    { id: 6, userId: 4, name: 'db-proxy',         ipAddress: '192.168.30.6',  description: 'PgBouncer connection pooler' },
  ] as MockHost[],

  policies: [
    { id: 1, hostId: 1, allowedProtocols: 'TCP',     portRangeMin: 25565, portRangeMax: 25565, maxRules: 3 },
    { id: 2, hostId: 2, allowedProtocols: 'TCP,UDP', portRangeMin: 9987,  portRangeMax: 9987,  maxRules: 2 },
    { id: 3, hostId: 3, allowedProtocols: 'TCP',     portRangeMin: 80,    portRangeMax: 8080,  maxRules: 5 },
    { id: 4, hostId: 4, allowedProtocols: 'UDP',     portRangeMin: 51820, portRangeMax: 51820, maxRules: 2 },
    { id: 5, hostId: 5, allowedProtocols: 'TCP,UDP', portRangeMin: 3000,  portRangeMax: 9000,  maxRules: 10 },
    { id: 6, hostId: 6, allowedProtocols: 'TCP',     portRangeMin: 5432,  portRangeMax: 5432,  maxRules: 3 },
  ] as MockPolicy[],

  natRules: [
    // phil
    { id: 1, userId: 2, host: { id: 1, name: 'minecraft-server', ipAddress: '192.168.10.50' }, protocol: 'TCP', portStart: 25565, portEnd: 25565, description: 'Minecraft Java Edition', pfSenseRuleId: 'pf-rule-001', status: 'ACTIVE',  createdAt: '2026-02-22T10:00:00Z', deletedAt: null },
    { id: 2, userId: 2, host: { id: 2, name: 'teamspeak-server', ipAddress: '192.168.10.51' }, protocol: 'UDP', portStart: 9987,  portEnd: 9987,  description: 'TeamSpeak voice',        pfSenseRuleId: 'pf-rule-002', status: 'ACTIVE',  createdAt: '2026-02-24T14:00:00Z', deletedAt: null },
    // lisa
    { id: 3, userId: 3, host: { id: 3, name: 'web-server',       ipAddress: '192.168.20.10' }, protocol: 'TCP', portStart: 80,    portEnd: 80,    description: 'HTTP frontend',          pfSenseRuleId: 'pf-rule-003', status: 'ACTIVE',  createdAt: '2026-02-20T08:00:00Z', deletedAt: null },
    { id: 4, userId: 3, host: { id: 3, name: 'web-server',       ipAddress: '192.168.20.10' }, protocol: 'TCP', portStart: 443,   portEnd: 443,   description: 'HTTPS frontend',         pfSenseRuleId: 'pf-rule-004', status: 'ACTIVE',  createdAt: '2026-02-20T08:01:00Z', deletedAt: null },
    { id: 5, userId: 3, host: { id: 3, name: 'web-server',       ipAddress: '192.168.20.10' }, protocol: 'TCP', portStart: 8080,  portEnd: 8085,  description: 'Dev proxy',              pfSenseRuleId: 'pf-rule-005', status: 'ACTIVE',  createdAt: '2026-02-23T11:00:00Z', deletedAt: null },
    { id: 6, userId: 3, host: { id: 4, name: 'vpn-gateway',      ipAddress: '192.168.20.11' }, protocol: 'UDP', portStart: 51820, portEnd: 51820, description: 'WireGuard',              pfSenseRuleId: 'pf-rule-006', status: 'ACTIVE',  createdAt: '2026-02-18T09:00:00Z', deletedAt: null },
    // felix
    { id: 7, userId: 4, host: { id: 5, name: 'dev-server',       ipAddress: '192.168.30.5'  }, protocol: 'TCP', portStart: 3000,  portEnd: 3000,  description: 'React dev server',       pfSenseRuleId: 'pf-rule-007', status: 'ACTIVE',  createdAt: '2026-02-24T16:00:00Z', deletedAt: null },
    { id: 8, userId: 4, host: { id: 5, name: 'dev-server',       ipAddress: '192.168.30.5'  }, protocol: 'TCP', portStart: 8000,  portEnd: 8000,  description: 'Django backend',         pfSenseRuleId: 'pf-rule-008', status: 'ACTIVE',  createdAt: '2026-02-23T15:00:00Z', deletedAt: null },
    { id: 9, userId: 4, host: { id: 5, name: 'dev-server',       ipAddress: '192.168.30.5'  }, protocol: 'UDP', portStart: 5000,  portEnd: 5000,  description: 'Game server (test)',     pfSenseRuleId: null,          status: 'DELETED', createdAt: '2026-02-21T10:00:00Z', deletedAt: '2026-02-22T12:00:00Z' },
  ] as MockNatRule[],
}
