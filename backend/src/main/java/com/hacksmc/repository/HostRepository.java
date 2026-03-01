package com.hacksmc.repository;

import com.hacksmc.entity.Host;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface HostRepository extends JpaRepository<Host, Long> {
    List<Host> findByUserId(Long userId);
    Optional<Host> findByIdAndUserId(Long id, Long userId);
    long countByUserId(Long userId);
}
