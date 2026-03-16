package com.hacksmc.service;

import com.hacksmc.dto.SystemSettingsDto;
import com.hacksmc.dto.UpdateSystemSettingsRequest;
import com.hacksmc.entity.SystemSettings;
import com.hacksmc.repository.SystemSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Properties;

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
        // SMTP
        if (req.mailHost() != null) s.setMailHost(req.mailHost().isBlank() ? null : req.mailHost().trim());
        if (req.mailPort() != null && req.mailPort() > 0) s.setMailPort(req.mailPort());
        if (req.mailUsername() != null) s.setMailUsername(req.mailUsername().isBlank() ? null : req.mailUsername().trim());
        if (req.mailPassword() != null && !req.mailPassword().isBlank()) s.setMailPassword(req.mailPassword());
        if (req.mailTlsEnabled() != null) s.setMailTlsEnabled(req.mailTlsEnabled());
        if (req.mailFrom() != null) s.setMailFrom(req.mailFrom().isBlank() ? null : req.mailFrom().trim());
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
            s.getUpdatedBy(), s.getUpdatedAt(),
            s.getMailHost(), s.getMailPort(), s.getMailUsername(),
            s.getMailPassword() != null && !s.getMailPassword().isBlank(),
            s.isMailTlsEnabled(), s.getMailFrom()
        );
    }

    /** Build a JavaMailSenderImpl from the current DB settings. Returns null if mailHost is not configured. */
    public JavaMailSenderImpl buildMailSender(SystemSettings s) {
        if (s.getMailHost() == null || s.getMailHost().isBlank()) return null;
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(s.getMailHost());
        sender.setPort(s.getMailPort() > 0 ? s.getMailPort() : 587);
        if (s.getMailUsername() != null) sender.setUsername(s.getMailUsername());
        if (s.getMailPassword() != null) sender.setPassword(s.getMailPassword());
        sender.setDefaultEncoding("UTF-8");
        Properties props = sender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.auth", s.getMailUsername() != null && !s.getMailUsername().isBlank() ? "true" : "false");
        props.put("mail.smtp.starttls.enable", String.valueOf(s.isMailTlsEnabled()));
        props.put("mail.smtp.timeout", "5000");
        props.put("mail.smtp.connectiontimeout", "5000");
        return sender;
    }
}
