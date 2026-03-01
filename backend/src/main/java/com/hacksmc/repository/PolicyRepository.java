package com.hacksmc.repository;

import com.hacksmc.entity.Policy;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface PolicyRepository extends JpaRepository<Policy, Long> {
    Optional<Policy> findByHostId(Long hostId);
    List<Policy> findByHostUserId(Long userId);
}
