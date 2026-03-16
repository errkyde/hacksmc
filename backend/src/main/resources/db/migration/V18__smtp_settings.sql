ALTER TABLE system_settings ADD COLUMN mail_host        VARCHAR(255);
ALTER TABLE system_settings ADD COLUMN mail_port        INT NOT NULL DEFAULT 587;
ALTER TABLE system_settings ADD COLUMN mail_username    VARCHAR(255);
ALTER TABLE system_settings ADD COLUMN mail_password    VARCHAR(500);
ALTER TABLE system_settings ADD COLUMN mail_tls_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE system_settings ADD COLUMN mail_from        VARCHAR(255);
