package com.hacksmc.repository;

import com.hacksmc.entity.NetworkGroup;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface NetworkGroupRepository extends JpaRepository<NetworkGroup, Long> {

    /** All groups in a specific view, ordered by layer. */
    List<NetworkGroup> findByViewIdOrderByLayerOrderAsc(Long viewId);

    /** Find a group by name within a specific view (used for auto-grouping dedup). */
    Optional<NetworkGroup> findByNameAndViewId(String name, Long viewId);

    // Legacy — kept for any code that hasn't been migrated yet
    List<NetworkGroup> findAllByOrderByLayerOrderAsc();
    Optional<NetworkGroup> findByName(String name);
}
