package com.hacksmc.repository;

import com.hacksmc.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    List<AuditLog> findTop200ByOrderByTsDesc();

    @Query("""
        SELECT e FROM AuditLog e
        WHERE (:actor = '' OR LOWER(e.actor) = LOWER(:actor))
          AND (:action = '' OR e.action = :action)
        ORDER BY e.ts DESC
        """)
    Page<AuditLog> findFiltered(
            @Param("actor") String actor,
            @Param("action") String action,
            Pageable pageable);

    @Query("SELECT DISTINCT e.actor FROM AuditLog e ORDER BY e.actor")
    List<String> findDistinctActors();

    @Query("SELECT DISTINCT e.action FROM AuditLog e ORDER BY e.action")
    List<String> findDistinctActions();
}
