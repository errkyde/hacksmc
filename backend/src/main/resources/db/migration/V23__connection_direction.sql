-- Traffic direction for topology connections: INBOUND, OUTBOUND, INTERNAL, UNKNOWN
ALTER TABLE network_connections
    ADD COLUMN direction VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN';
