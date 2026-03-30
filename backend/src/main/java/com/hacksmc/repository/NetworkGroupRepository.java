package com.hacksmc.repository;

import com.hacksmc.entity.NetworkGroup;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface NetworkGroupRepository extends JpaRepository<NetworkGroup, Long> {
    List<NetworkGroup> findAllByOrderByLayerOrderAsc();
    Optional<NetworkGroup> findByName(String name);
}
