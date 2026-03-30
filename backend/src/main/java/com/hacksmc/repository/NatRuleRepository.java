package com.hacksmc.repository;

import com.hacksmc.entity.NatRule;
import com.hacksmc.entity.NatRuleStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.Instant;
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

    long countByHostIdAndStatus(Long hostId, NatRuleStatus status);

    List<NatRule> findByHostIdAndStatusIn(Long hostId, List<NatRuleStatus> statuses);

    /** Global port-range overlap check — across all users and hosts */
    @Query("SELECT CASE WHEN COUNT(r) > 0 THEN TRUE ELSE FALSE END " +
           "FROM NatRule r " +
           "WHERE r.status IN :statuses " +
           "AND r.portStart <= :portEnd AND r.portEnd >= :portStart")
    boolean existsByPortRangeOverlapAndStatusIn(
        @Param("portStart") int portStart,
        @Param("portEnd") int portEnd,
        @Param("statuses") List<NatRuleStatus> statuses);

    List<NatRule> findByExpiresAtBeforeAndStatusIn(Instant expiresAt, List<NatRuleStatus> statuses);

    @Query("SELECT r FROM NatRule r JOIN FETCH r.user JOIN FETCH r.host ORDER BY r.createdAt DESC")
    List<NatRule> findAllWithUserAndHost();

    @Query("SELECT r FROM NatRule r JOIN FETCH r.host WHERE r.status = com.hacksmc.entity.NatRuleStatus.ACTIVE")
    List<NatRule> findActiveWithHost();
}
