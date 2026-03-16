package com.hacksmc.repository;

import com.hacksmc.entity.NotificationSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Optional;

public interface NotificationSettingsRepository extends JpaRepository<NotificationSettings, Long> {
    Optional<NotificationSettings> findByUserId(Long userId);

    @Query("SELECT ns FROM NotificationSettings ns JOIN FETCH ns.user WHERE ns.emailEnabled = true")
    List<NotificationSettings> findAllWithEmailEnabled();
}
