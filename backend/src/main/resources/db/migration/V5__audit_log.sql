-- B2: Audit log for security-relevant events
CREATE TABLE audit_log (
    id      BIGSERIAL PRIMARY KEY,
    ts      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    actor   VARCHAR(64)  NOT NULL,
    action  VARCHAR(64)  NOT NULL,
    target  VARCHAR(255),
    detail  TEXT
);

CREATE INDEX idx_audit_log_ts ON audit_log(ts DESC);
