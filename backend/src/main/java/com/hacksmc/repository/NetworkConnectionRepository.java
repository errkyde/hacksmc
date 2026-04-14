package com.hacksmc.repository;

import com.hacksmc.entity.NetworkConnection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface NetworkConnectionRepository extends JpaRepository<NetworkConnection, Long> {

    /** All connections where both devices belong to the given view. */
    @Query("SELECT c FROM NetworkConnection c WHERE c.source.view.id = :viewId ORDER BY c.createdAt ASC")
    List<NetworkConnection> findByViewId(@Param("viewId") Long viewId);

    /** Connections where both endpoints are in the given device ID set (used for user-visible filtering). */
    @Query("SELECT c FROM NetworkConnection c WHERE c.source.id IN :deviceIds AND c.target.id IN :deviceIds ORDER BY c.createdAt ASC")
    List<NetworkConnection> findVisibleConnections(@Param("deviceIds") List<Long> deviceIds);

    @Query("SELECT c FROM NetworkConnection c WHERE c.source.id = :deviceId OR c.target.id = :deviceId ORDER BY c.createdAt ASC")
    List<NetworkConnection> findByDeviceId(@Param("deviceId") Long deviceId);

    boolean existsBySourceIdAndTargetIdAndPortStart(Long sourceId, Long targetId, Integer portStart);

    /** Checks if any connection exists between two devices, regardless of port. */
    boolean existsBySourceIdAndTargetId(Long sourceId, Long targetId);

    // Legacy full-table scan (used only where already scoped to a single view via device IDs)
    List<NetworkConnection> findAllByOrderByCreatedAtAsc();
}
