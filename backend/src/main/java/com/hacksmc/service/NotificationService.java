package com.hacksmc.service;

import com.hacksmc.entity.EmailNotificationProfile;
import com.hacksmc.entity.NatRule;
import com.hacksmc.entity.NotificationSettings;
import com.hacksmc.entity.SystemSettings;
import com.hacksmc.repository.EmailNotificationProfileRepository;
import com.hacksmc.repository.NotificationSettingsRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class NotificationService {

    private final NotificationSettingsRepository notifRepo;
    private final EmailNotificationProfileRepository emailProfileRepo;
    private final MaintenanceService maintenanceService;
    private final JavaMailSender mailSender;
    private final RestClient restClient;

    public NotificationService(NotificationSettingsRepository notifRepo,
                                EmailNotificationProfileRepository emailProfileRepo,
                                MaintenanceService maintenanceService,
                                @Autowired(required = false) JavaMailSender mailSender) {
        this.notifRepo = notifRepo;
        this.emailProfileRepo = emailProfileRepo;
        this.maintenanceService = maintenanceService;
        this.mailSender = mailSender;
        this.restClient = RestClient.create();
    }

    /**
     * action: "CREATED" | "DELETED" | "EXPIRED"
     */
    public void notifyRuleEvent(String action, NatRule rule) {
        try {
            SystemSettings settings = maintenanceService.getSettings();
            String hostName = rule.getHost().getName();
            Long hostId = rule.getHost().getId();
            String actorUsername = rule.getUser().getUsername();
            String portStr = rule.getPortStart() == rule.getPortEnd()
                    ? String.valueOf(rule.getPortStart())
                    : rule.getPortStart() + "-" + rule.getPortEnd();
            String subject = "[HackSMC] Regel " + action.toLowerCase() + ": " + hostName + " " + rule.getProtocol() + ":" + portStr;
            String body = buildEmailBody(action, rule, hostName, portStr, actorUsername);

            // Email notifications (legacy per-user settings)
            if (mailSender != null) {
                List<NotificationSettings> eligible = notifRepo.findAllWithEmailEnabled();
                for (NotificationSettings ns : eligible) {
                    if (!shouldNotify(ns, action, hostId, actorUsername)) continue;
                    sendEmail(ns.getEmail(), subject, body);
                }
            }

            // Email notification profiles
            if (mailSender != null) {
                Long actorUserId = rule.getUser().getId();
                List<EmailNotificationProfile> profiles = emailProfileRepo.findAllByOrderByCreatedAtAsc();
                for (EmailNotificationProfile p : profiles) {
                    if (!shouldNotifyProfile(p, action, actorUserId)) continue;
                    sendEmail(p.getEmail(), subject, body);
                }
            }

            // Discord webhook
            if (settings.isDiscordEnabled() && settings.getDiscordWebhookUrl() != null
                    && !settings.getDiscordWebhookUrl().isBlank()) {
                boolean shouldSend = ("CREATED".equals(action) && settings.isDiscordNotifyCreate())
                        || ("DELETED".equals(action) && settings.isDiscordNotifyDelete())
                        || ("EXPIRED".equals(action) && settings.isDiscordNotifyExpire());
                if (shouldSend) {
                    sendDiscord(settings.getDiscordWebhookUrl(), action, rule, hostName, portStr, actorUsername);
                }
            }
        } catch (Exception e) {
            log.warn("NotificationService error for action={}: {}", action, e.getMessage());
        }
    }

    private boolean shouldNotify(NotificationSettings ns, String action, Long hostId, String actorUsername) {
        if ("CREATED".equals(action) && !ns.isNotifyOnCreate()) return false;
        if ("DELETED".equals(action) && !ns.isNotifyOnDelete()) return false;
        if ("EXPIRED".equals(action) && !ns.isNotifyOnExpire()) return false;
        if (!ns.isNotifyAllHosts() && !ns.getHostFilter().isEmpty() && !ns.getHostFilter().contains(hostId)) return false;
        if ("OWN".equals(ns.getNotifyScope()) && !actorUsername.equals(ns.getUser().getUsername())) return false;
        return true;
    }

    private boolean shouldNotifyProfile(EmailNotificationProfile p, String action, Long actorUserId) {
        if ("CREATED".equals(action) && !p.isNotifyOnCreate()) return false;
        if ("DELETED".equals(action) && !p.isNotifyOnDelete()) return false;
        if ("EXPIRED".equals(action) && !p.isNotifyOnExpire()) return false;
        if ("SPECIFIC".equals(p.getScope()) && !p.getUserIds().contains(actorUserId)) return false;
        return true;
    }

    private void sendEmail(String to, String subject, String body) {
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setTo(to);
            msg.setSubject(subject);
            msg.setText(body);
            mailSender.send(msg);
            log.info("Email sent to {}: {}", to, subject);
        } catch (Exception e) {
            log.warn("Failed to send email to {}: {}", to, e.getMessage());
        }
    }

    private String buildEmailBody(String action, NatRule rule, String hostName, String portStr, String actor) {
        return String.format("""
                HackSMC — NAT-Regel %s

                Host:       %s (%s)
                Protokoll:  %s
                Port(s):    %s
                Benutzer:   %s
                Beschreibung: %s
                Regel-ID:   %d
                """,
                action,
                hostName, rule.getHost().getIpAddress(),
                rule.getProtocol(),
                portStr,
                actor,
                rule.getDescription() != null ? rule.getDescription() : "—",
                rule.getId());
    }

    private void sendDiscord(String webhookUrl, String action, NatRule rule,
                              String hostName, String portStr, String actor) {
        try {
            int color = switch (action) {
                case "CREATED" -> 0x00B0F4;
                case "DELETED" -> 0xED4245;
                case "EXPIRED" -> 0xFEA832;
                default -> 0x808080;
            };
            String title = switch (action) {
                case "CREATED" -> "✅ NAT-Regel erstellt";
                case "DELETED" -> "🗑️ NAT-Regel gelöscht";
                case "EXPIRED" -> "⏰ NAT-Regel abgelaufen";
                default -> "NAT-Regel " + action;
            };

            Map<String, Object> embed = new HashMap<>();
            embed.put("title", title);
            embed.put("color", color);
            embed.put("fields", List.of(
                field("Host", hostName, true),
                field("Protokoll:Port", rule.getProtocol() + ":" + portStr, true),
                field("Benutzer", actor, true),
                field("Beschreibung", rule.getDescription() != null ? rule.getDescription() : "—", true)
            ));
            embed.put("timestamp", java.time.Instant.now().toString());

            Map<String, Object> payload = new HashMap<>();
            payload.put("embeds", List.of(embed));

            restClient.post()
                    .uri(webhookUrl)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
            log.info("Discord notification sent: {}", title);
        } catch (Exception e) {
            log.warn("Discord webhook failed: {}", e.getMessage());
        }
    }

    private Map<String, Object> field(String name, String value, boolean inline) {
        return Map.of("name", name, "value", value, "inline", inline);
    }
}
