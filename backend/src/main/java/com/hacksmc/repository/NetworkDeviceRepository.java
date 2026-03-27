package com.hacksmc.repository;

import com.hacksmc.entity.NetworkDevice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface NetworkDeviceRepository extends JpaRepository<NetworkDevice, Long> {
    List<NetworkDevice> findAllByOrderByCreatedAtAsc();
    boolean existsByIpAddress(String ipAddress);
    Optional<NetworkDevice> findByIpAddress(String ipAddress);

    @Query("SELECT d FROM NetworkDevice d WHERE d.host.id IN :hostIds OR d.isShared = true ORDER BY d.createdAt ASC")
    List<NetworkDevice> findVisibleForHosts(@Param("hostIds") List<Long> hostIds);

    @Query("SELECT d FROM NetworkDevice d WHERE d.isShared = true ORDER BY d.createdAt ASC")
    List<NetworkDevice> findAllShared();
}
