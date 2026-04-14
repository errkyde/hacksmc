-- Topology Views: named, switchable topology canvases.
-- Each group and device belongs to exactly one view.
-- Connections are implicitly scoped by their source/target device's view.

CREATE TABLE topology_views (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    is_auto     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- The default "Auto" view — populated by Auto Scan, non-deletable from UI
INSERT INTO topology_views (name, is_auto) VALUES ('Auto', true);

-- Add view_id FK to groups
ALTER TABLE network_groups
    ADD COLUMN view_id BIGINT REFERENCES topology_views(id) ON DELETE CASCADE;

-- Assign all existing groups to the auto view
UPDATE network_groups SET view_id = 1;

-- Make it non-nullable
ALTER TABLE network_groups ALTER COLUMN view_id SET NOT NULL;

-- Add view_id FK to devices
ALTER TABLE network_devices
    ADD COLUMN view_id BIGINT REFERENCES topology_views(id) ON DELETE CASCADE;

-- Assign all existing devices to the auto view
UPDATE network_devices SET view_id = 1;

-- Make it non-nullable
ALTER TABLE network_devices ALTER COLUMN view_id SET NOT NULL;
