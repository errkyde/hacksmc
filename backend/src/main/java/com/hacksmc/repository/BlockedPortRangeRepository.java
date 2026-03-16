package com.hacksmc.repository;

import com.hacksmc.entity.BlockedPortRange;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BlockedPortRangeRepository extends JpaRepository<BlockedPortRange, Long> {
    @Query("SELECT CASE WHEN COUNT(r) > 0 THEN TRUE ELSE FALSE END FROM BlockedPortRange r " +
           "WHERE r.portStart <= :portEnd AND r.portEnd >= :portStart")
    boolean existsByPortRangeOverlap(@Param("portStart") int portStart, @Param("portEnd") int portEnd);
}
