package com.hacksmc.repository;

import com.hacksmc.entity.Policy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PolicyRepository extends JpaRepository<Policy, Long> {

    @Query("SELECT p FROM Policy p JOIN FETCH p.host WHERE p.user.id = :userId")
    List<Policy> findByUserIdWithHost(@Param("userId") Long userId);

    Optional<Policy> findByUserIdAndHostId(Long userId, Long hostId);

    boolean existsByUserIdAndHostId(Long userId, Long hostId);

    long countByUserId(Long userId);
}
