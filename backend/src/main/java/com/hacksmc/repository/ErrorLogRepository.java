package com.hacksmc.repository;

import com.hacksmc.entity.ErrorLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ErrorLogRepository extends JpaRepository<ErrorLog, Long> {
    List<ErrorLog> findTop50ByOrderByTsDesc();
}
