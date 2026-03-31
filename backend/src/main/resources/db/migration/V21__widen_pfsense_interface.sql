-- Widen pf_sense_interface — some pfSense interface names exceed 20 characters
ALTER TABLE network_devices
    ALTER COLUMN pf_sense_interface TYPE VARCHAR(100);
