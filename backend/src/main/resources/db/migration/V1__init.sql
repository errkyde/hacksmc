-- Users
CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    username      VARCHAR(64) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(16) NOT NULL DEFAULT 'USER'
);

-- Hosts assigned to users
CREATE TABLE hosts (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(128) NOT NULL,
    ip_address  VARCHAR(45) NOT NULL,
    description VARCHAR(255)
);

-- RBAC policy per host
CREATE TABLE policies (
    id                 BIGSERIAL PRIMARY KEY,
    host_id            BIGINT NOT NULL UNIQUE REFERENCES hosts(id) ON DELETE CASCADE,
    allowed_protocols  VARCHAR(32) NOT NULL DEFAULT 'TCP',  -- e.g. 'TCP,UDP'
    port_range_min     INT NOT NULL,
    port_range_max     INT NOT NULL,
    max_rules          INT NOT NULL DEFAULT 5,
    CONSTRAINT chk_port_range CHECK (port_range_min <= port_range_max),
    CONSTRAINT chk_max_rules  CHECK (max_rules >= 1)
);

-- NAT rules created via pfSense
CREATE TABLE nat_rules (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT NOT NULL REFERENCES users(id),
    host_id          BIGINT NOT NULL REFERENCES hosts(id),
    protocol         VARCHAR(8) NOT NULL,
    port             INT NOT NULL CHECK (port BETWEEN 1 AND 65535),
    description      VARCHAR(255),
    pf_sense_rule_id VARCHAR(128),
    status           VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at       TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_nat_rules_user     ON nat_rules(user_id);
CREATE INDEX idx_nat_rules_host     ON nat_rules(host_id);
CREATE INDEX idx_nat_rules_status   ON nat_rules(status);
