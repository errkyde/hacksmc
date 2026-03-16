CREATE TABLE notification_settings (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    email            VARCHAR(255),
    email_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
    notify_on_create BOOLEAN NOT NULL DEFAULT TRUE,
    notify_on_delete BOOLEAN NOT NULL DEFAULT TRUE,
    notify_on_expire BOOLEAN NOT NULL DEFAULT TRUE,
    notify_all_hosts BOOLEAN NOT NULL DEFAULT TRUE,
    notify_scope     VARCHAR(10) NOT NULL DEFAULT 'OWN' CHECK (notify_scope IN ('OWN','ALL'))
);

CREATE TABLE notification_host_filters (
    settings_id BIGINT NOT NULL REFERENCES notification_settings(id) ON DELETE CASCADE,
    host_id     BIGINT NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
    PRIMARY KEY (settings_id, host_id)
);
