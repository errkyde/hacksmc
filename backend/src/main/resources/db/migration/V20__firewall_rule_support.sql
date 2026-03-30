-- Add pfSense interface field to network_devices (for firewall rule creation)
ALTER TABLE network_devices
    ADD COLUMN pf_sense_interface VARCHAR(20);

-- Add firewall rule ID to network_connections
ALTER TABLE network_connections
    ADD COLUMN firewall_rule_id VARCHAR(50);
