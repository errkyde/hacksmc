package com.hacksmc.service;

import com.hacksmc.dto.SystemSettingsDto;
import com.hacksmc.dto.UpdateSystemSettingsRequest;
import com.hacksmc.entity.SystemSettings;
import com.hacksmc.repository.SystemSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class MaintenanceService {

    private final SystemSettingsRepository repo;

    @Transactional(readOnly = true)
    public SystemSettings getSettings() {
        return repo.findById(1).orElseGet(() -> {
            SystemSettings s = new SystemSettings();
            return repo.save(s);
        });
    }

    @Transactional
    public SystemSettingsDto update(UpdateSystemSettingsRequest req, String actor) {
        SystemSettings s = getSettings();
        s.setSiteMaintenance(req.siteMaintenance());
        s.setPfSenseMaintenance(req.pfSenseMaintenance());
        if (req.siteMaintenanceMessage() != null && !req.siteMaintenanceMessage().isBlank())
            s.setSiteMaintenanceMessage(req.siteMaintenanceMessage());
        s.setDiscordWebhookUrl(req.discordWebhookUrl());
        s.setDiscordEnabled(req.discordEnabled());
        s.setDiscordNotifyCreate(req.discordNotifyCreate());
        s.setDiscordNotifyDelete(req.discordNotifyDelete());
        s.setDiscordNotifyExpire(req.discordNotifyExpire());
        s.setUpdatedBy(actor);
        s.setUpdatedAt(Instant.now());
        repo.save(s);
        return toDto(s);
    }

    public SystemSettingsDto toDto(SystemSettings s) {
        return new SystemSettingsDto(
            s.isSiteMaintenance(), s.isPfSenseMaintenance(), s.getSiteMaintenanceMessage(),
            s.getDiscordWebhookUrl(), s.isDiscordEnabled(),
            s.isDiscordNotifyCreate(), s.isDiscordNotifyDelete(), s.isDiscordNotifyExpire(),
            s.getUpdatedBy(), s.getUpdatedAt()
        );
    }
}
