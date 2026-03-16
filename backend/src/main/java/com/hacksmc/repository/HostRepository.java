package com.hacksmc.repository;

import com.hacksmc.entity.Host;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HostRepository extends JpaRepository<Host, Long> {
    boolean existsByIpAddress(String ipAddress);
    boolean existsByIpAddressAndIdNot(String ipAddress, Long id);
}
