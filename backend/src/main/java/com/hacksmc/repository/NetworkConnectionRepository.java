package com.hacksmc.repository;

import com.hacksmc.entity.NetworkConnection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface NetworkConnectionRepository extends JpaRepository<NetworkConnection, Long> {
    List<NetworkConnection> findAllByOrderByCreatedAtAsc();

    @Query("SELECT c FROM NetworkConnection c WHERE c.source.id IN :deviceIds AND c.target.id IN :deviceIds ORDER BY c.createdAt ASC")
    List<NetworkConnection> findVisibleConnections(@Param("deviceIds") List<Long> deviceIds);

    @Query("SELECT c FROM NetworkConnection c WHERE c.source.id = :deviceId OR c.target.id = :deviceId ORDER BY c.createdAt ASC")
    List<NetworkConnection> findByDeviceId(@Param("deviceId") Long deviceId);
}
