package com.hacksmc.repository;

import com.hacksmc.entity.NatRule;
import com.hacksmc.entity.NatRuleStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface NatRuleRepository extends JpaRepository<NatRule, Long> {
    @Query("SELECT r FROM NatRule r JOIN FETCH r.host WHERE r.user.id = :userId ORDER BY COALESCE(r.pfSensePosition, 999999) ASC, r.createdAt DESC")
    List<NatRule> findByUserIdWithHost(@Param("userId") Long userId);

    List<NatRule> findByUserIdAndStatus(Long userId, NatRuleStatus status);
    long countByUserIdAndHostIdAndStatus(Long userId, Long hostId, NatRuleStatus status);
    Optional<NatRule> findByIdAndUserId(Long id, Long userId);

    List<NatRule> findByStatus(NatRuleStatus status);

    /** Globale Port-Belegungsprüfung — unabhängig von Nutzer oder Host */
    boolean existsByPortAndStatusIn(int port, List<NatRuleStatus> statuses);

    @Query("SELECT r FROM NatRule r JOIN FETCH r.user JOIN FETCH r.host ORDER BY r.createdAt DESC")
    List<NatRule> findAllWithUserAndHost();
}
