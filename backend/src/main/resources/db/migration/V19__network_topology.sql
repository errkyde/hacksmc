CREATE TABLE network_groups (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    color       VARCHAR(20) NOT NULL DEFAULT '#64748b',
    layer_order INT NOT NULL DEFAULT 0,
    collapsed   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE network_devices (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    ip_address  VARCHAR(45),
    mac_address VARCHAR(17),
    hostname    VARCHAR(255),
    description VARCHAR(500),
    device_type VARCHAR(50) NOT NULL DEFAULT 'UNKNOWN',
    group_id    BIGINT REFERENCES network_groups(id) ON DELETE SET NULL,
    pos_x       DOUBLE PRECISION NOT NULL DEFAULT 0,
    pos_y       DOUBLE PRECISION NOT NULL DEFAULT 0,
    is_manual   BOOLEAN NOT NULL DEFAULT TRUE,
    is_shared   BOOLEAN NOT NULL DEFAULT FALSE,
    host_id     BIGINT REFERENCES hosts(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE network_connections (
    id               BIGSERIAL PRIMARY KEY,
    source_device_id BIGINT NOT NULL REFERENCES network_devices(id) ON DELETE CASCADE,
    target_device_id BIGINT NOT NULL REFERENCES network_devices(id) ON DELETE CASCADE,
    protocol         VARCHAR(20),
    port_start       INT,
    port_end         INT,
    label            VARCHAR(200),
    status           VARCHAR(20) NOT NULL DEFAULT 'OK',
    nat_rule_id      BIGINT REFERENCES nat_rules(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_network_devices_group   ON network_devices(group_id);
CREATE INDEX idx_network_devices_host    ON network_devices(host_id);
CREATE INDEX idx_network_connections_src ON network_connections(source_device_id);
CREATE INDEX idx_network_connections_tgt ON network_connections(target_device_id);
