package com.hacksmc.service;

import com.hacksmc.dto.AuditLogEntry;
import com.hacksmc.dto.AuditLogPage;
import com.hacksmc.entity.AuditLog;
import com.hacksmc.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
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

    @Transactional(readOnly = true)
    public AuditLogPage getPage(int page, int size, String actor, String action) {
        Page<AuditLog> result = auditLogRepository.findFiltered(
                (actor == null || actor.isBlank()) ? "" : actor,
                (action == null || action.isBlank()) ? "" : action,
                PageRequest.of(page, size));
        List<AuditLogEntry> content = result.getContent().stream()
                .map(e -> new AuditLogEntry(e.getId(), e.getTs(), e.getActor(),
                        e.getAction(), e.getTarget(), e.getDetail()))
                .toList();
        return new AuditLogPage(
                content,
                result.getTotalElements(),
                result.getTotalPages(),
                page,
                size,
                auditLogRepository.findDistinctActors(),
                auditLogRepository.findDistinctActions()
        );
    }
}
