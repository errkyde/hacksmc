-- =============================================================================
-- Seed data — development / initial setup
-- Admin user: admin / admin   (BCrypt, cost 10)
-- =============================================================================

INSERT INTO users (username, password_hash, role) VALUES
  ('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'ADMIN'),
  ('phil',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'USER');

-- Hosts for user "phil" (id=2)
INSERT INTO hosts (user_id, name, ip_address, description) VALUES
  (2, 'minecraft-server',  '192.168.10.50', 'Minecraft game server'),
  (2, 'teamspeak-server',  '192.168.10.51', 'TeamSpeak voice server');

-- Policies: one per host
-- minecraft: TCP only, ports 25565-25565, max 3 rules
INSERT INTO policies (host_id, allowed_protocols, port_range_min, port_range_max, max_rules) VALUES
  (1, 'TCP',     25565, 25565, 3),
  (2, 'TCP,UDP', 9987,  9987,  2);
