ALTER TABLE nat_rules RENAME COLUMN port TO port_start;
ALTER TABLE nat_rules ADD COLUMN port_end INT NOT NULL DEFAULT 0;
UPDATE nat_rules SET port_end = port_start;
ALTER TABLE nat_rules ALTER COLUMN port_end DROP DEFAULT;
ALTER TABLE nat_rules ADD CONSTRAINT chk_nat_port_end CHECK (port_end BETWEEN 1 AND 65535);
ALTER TABLE nat_rules ADD CONSTRAINT chk_nat_port_range CHECK (port_start <= port_end);
