-- Groups marked as scan_blocked are skipped during ARP/CIDR auto-import.
-- Individual devices can still be manually added to these groups.
ALTER TABLE network_groups
    ADD COLUMN scan_blocked BOOLEAN NOT NULL DEFAULT FALSE;
