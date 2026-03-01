package com.hacksmc.service;

import com.hacksmc.dto.AuditLogEntry;
import com.hacksmc.entity.AuditLog;
import com.hacksmc.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    @Transactional
    public void log(String actor, String action, String target, String detail) {
        AuditLog entry = new AuditLog();
        entry.setActor(actor);
        entry.setAction(action);
        entry.setTarget(target);
        entry.setDetail(detail);
        auditLogRepository.save(entry);
    }

    @Transactional(readOnly = true)
    public List<AuditLogEntry> getRecent() {
        return auditLogRepository.findTop200ByOrderByTsDesc().stream()
                .map(e -> new AuditLogEntry(e.getId(), e.getTs(), e.getActor(),
                        e.getAction(), e.getTarget(), e.getDetail()))
                .toList();
    }
}
