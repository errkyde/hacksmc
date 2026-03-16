CREATE TABLE blocked_port_ranges (
    id BIGSERIAL PRIMARY KEY,
    port_start INT NOT NULL,
    port_end   INT NOT NULL,
    reason     VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_blocked_port_start CHECK (port_start BETWEEN 1 AND 65535),
    CONSTRAINT chk_blocked_port_end   CHECK (port_end   BETWEEN 1 AND 65535),
    CONSTRAINT chk_blocked_range      CHECK (port_start <= port_end)
);
