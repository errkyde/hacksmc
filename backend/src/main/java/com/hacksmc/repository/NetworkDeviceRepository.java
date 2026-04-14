package com.hacksmc.repository;

import com.hacksmc.entity.NetworkDevice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface NetworkDeviceRepository extends JpaRepository<NetworkDevice, Long> {

    /** All devices in a specific view, ordered by creation time. */
    List<NetworkDevice> findByViewIdOrderByCreatedAtAsc(Long viewId);

    /** Devices visible to a user: their host-linked devices + all shared devices, within a view. */
    @Query("SELECT d FROM NetworkDevice d WHERE d.view.id = :viewId AND (d.host.id IN :hostIds OR d.isShared = true) ORDER BY d.createdAt ASC")
    List<NetworkDevice> findVisibleForHosts(@Param("viewId") Long viewId, @Param("hostIds") List<Long> hostIds);

    /** All shared devices in a view (for users with no host assignments). */
    @Query("SELECT d FROM NetworkDevice d WHERE d.view.id = :viewId AND d.isShared = true ORDER BY d.createdAt ASC")
    List<NetworkDevice> findAllShared(@Param("viewId") Long viewId);

    /** IP address lookup within a view (for scan upsert dedup). */
    Optional<NetworkDevice> findByIpAddressAndViewId(String ipAddress, Long viewId);

    boolean existsByIpAddressAndViewId(String ipAddress, Long viewId);

    /** Find by name within a view (for import operations). */
    Optional<NetworkDevice> findFirstByNameAndViewId(String name, Long viewId);

    // Legacy — kept for AutoTopologyScanService's ensureInternetDevice check (auto view only)
    List<NetworkDevice> findAllByOrderByCreatedAtAsc();
    boolean existsByIpAddress(String ipAddress);
    Optional<NetworkDevice> findByIpAddress(String ipAddress);
    Optional<NetworkDevice> findFirstByName(String name);
}
