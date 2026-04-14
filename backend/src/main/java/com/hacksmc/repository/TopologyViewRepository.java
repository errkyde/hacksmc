package com.hacksmc.repository;

import com.hacksmc.entity.TopologyView;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TopologyViewRepository extends JpaRepository<TopologyView, Long> {
    List<TopologyView> findAllByOrderByCreatedAtAsc();
}
