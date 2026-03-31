-- Groups can be marked as hidden to exclude their devices from the topology canvas
ALTER TABLE network_groups
    ADD COLUMN hidden BOOLEAN NOT NULL DEFAULT FALSE;
