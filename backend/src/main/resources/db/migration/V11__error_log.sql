CREATE TABLE error_log (
  id          BIGSERIAL PRIMARY KEY,
  ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor       VARCHAR(64),
  method      VARCHAR(10),
  path        VARCHAR(255),
  http_status INT NOT NULL,
  error_type  VARCHAR(64),
  message     TEXT
);
