package com.hacksmc.repository;

import com.hacksmc.entity.EmailNotificationProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface EmailNotificationProfileRepository extends JpaRepository<EmailNotificationProfile, Long> {
    List<EmailNotificationProfile> findAllByOrderByCreatedAtAsc();
}
