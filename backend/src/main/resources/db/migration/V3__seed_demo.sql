-- =============================================================================
-- Demo seed — additional users, hosts, policies, NAT rules
-- All passwords: "admin"  (BCrypt cost 10)
-- =============================================================================

-- ── Users (id 3-5) ────────────────────────────────────────────────────────────
INSERT INTO users (username, password_hash, role) VALUES
  ('lisa',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'USER'),
  ('felix', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'USER'),
  ('sarah', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'USER');

-- ── Hosts ─────────────────────────────────────────────────────────────────────
-- lisa (id=3): web server
INSERT INTO hosts (user_id, name, ip_address, description) VALUES
  (3, 'web-server',    '192.168.20.10', 'Nginx web server'),
  (3, 'vpn-gateway',  '192.168.20.11', 'WireGuard VPN endpoint');

-- felix (id=4): dev server
INSERT INTO hosts (user_id, name, ip_address, description) VALUES
  (4, 'dev-server',   '192.168.30.5',  'Development & staging server'),
  (4, 'db-proxy',     '192.168.30.6',  'PgBouncer connection pooler');

-- sarah (id=5): no hosts yet — shows empty state in admin panel

-- ── Policies ──────────────────────────────────────────────────────────────────
-- lisa: web-server → TCP only, ports 80-8080, max 5 rules
-- lisa: vpn-gateway → UDP only, ports 51820-51820, max 2 rules
-- felix: dev-server → TCP+UDP, ports 3000-9000, max 10 rules
-- felix: db-proxy   → TCP only, ports 5432-5432, max 3 rules
INSERT INTO policies (host_id, allowed_protocols, port_range_min, port_range_max, max_rules) VALUES
  (3, 'TCP',     80,    8080,  5),
  (4, 'UDP',     51820, 51820, 2),
  (5, 'TCP,UDP', 3000,  9000,  10),
  (6, 'TCP',     5432,  5432,  3);

-- ── NAT rules for phil ────────────────────────────────────────────────────────
-- Give phil two active rules so the dashboard has content
INSERT INTO nat_rules (user_id, host_id, protocol, port, description, pf_sense_rule_id, status, created_at) VALUES
  (2, 1, 'TCP', 25565, 'Minecraft Java Edition',  'pf-rule-001', 'ACTIVE',  NOW() - INTERVAL '3 days'),
  (2, 2, 'UDP', 9987,  'TeamSpeak voice',          'pf-rule-002', 'ACTIVE',  NOW() - INTERVAL '1 day');

-- ── NAT rules for lisa ────────────────────────────────────────────────────────
INSERT INTO nat_rules (user_id, host_id, protocol, port, description, pf_sense_rule_id, status, created_at) VALUES
  (3, 3, 'TCP', 80,   'HTTP frontend',             'pf-rule-003', 'ACTIVE',  NOW() - INTERVAL '5 days'),
  (3, 3, 'TCP', 443,  'HTTPS frontend',            'pf-rule-004', 'ACTIVE',  NOW() - INTERVAL '5 days'),
  (3, 3, 'TCP', 8080, 'Dev proxy',                 'pf-rule-005', 'ACTIVE',  NOW() - INTERVAL '2 days'),
  (3, 4, 'UDP', 51820,'WireGuard',                 'pf-rule-006', 'ACTIVE',  NOW() - INTERVAL '7 days');

-- ── NAT rules for felix ───────────────────────────────────────────────────────
INSERT INTO nat_rules (user_id, host_id, protocol, port, description, pf_sense_rule_id, status, created_at) VALUES
  (4, 5, 'TCP', 3000, 'React dev server',          'pf-rule-007', 'ACTIVE',  NOW() - INTERVAL '1 day'),
  (4, 5, 'TCP', 8000, 'Django backend',            'pf-rule-008', 'ACTIVE',  NOW() - INTERVAL '2 days'),
  (4, 5, 'UDP', 5000, 'Game server (test)',        NULL,          'DELETED', NOW() - INTERVAL '4 days');
