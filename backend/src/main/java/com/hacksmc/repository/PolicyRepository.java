package com.hacksmc.repository;

import com.hacksmc.entity.Policy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface PolicyRepository extends JpaRepository<Policy, Long> {
    Optional<Policy> findByHostId(Long hostId);

    @Query("SELECT p FROM Policy p JOIN FETCH p.host WHERE p.host.user.id = :userId")
    List<Policy> findByHostUserIdWithHost(@Param("userId") Long userId);
}
