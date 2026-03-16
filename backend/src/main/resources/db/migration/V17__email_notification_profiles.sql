CREATE TABLE email_notification_profiles (
    id              BIGSERIAL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL,
    notify_on_create BOOLEAN NOT NULL DEFAULT TRUE,
    notify_on_delete BOOLEAN NOT NULL DEFAULT TRUE,
    notify_on_expire BOOLEAN NOT NULL DEFAULT TRUE,
    scope           VARCHAR(20) NOT NULL DEFAULT 'ALL',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE email_notification_profile_users (
    profile_id BIGINT NOT NULL REFERENCES email_notification_profiles(id) ON DELETE CASCADE,
    user_id    BIGINT NOT NULL,
    PRIMARY KEY (profile_id, user_id)
);
