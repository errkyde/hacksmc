CREATE TABLE system_settings (
    id                          INT PRIMARY KEY DEFAULT 1,
    site_maintenance            BOOLEAN NOT NULL DEFAULT FALSE,
    pfsense_maintenance         BOOLEAN NOT NULL DEFAULT FALSE,
    site_maintenance_message    VARCHAR(500) NOT NULL DEFAULT 'Die Plattform befindet sich im Wartungsmodus.',
    discord_webhook_url         VARCHAR(1000),
    discord_enabled             BOOLEAN NOT NULL DEFAULT FALSE,
    discord_notify_create       BOOLEAN NOT NULL DEFAULT TRUE,
    discord_notify_delete       BOOLEAN NOT NULL DEFAULT TRUE,
    discord_notify_expire       BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by                  VARCHAR(255),
    updated_at                  TIMESTAMPTZ
);
INSERT INTO system_settings (id) VALUES (1);
