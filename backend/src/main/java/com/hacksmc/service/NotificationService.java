package com.hacksmc.service;

import com.hacksmc.entity.EmailNotificationProfile;
import com.hacksmc.entity.NatRule;
import com.hacksmc.entity.NotificationSettings;
import com.hacksmc.entity.SystemSettings;
import com.hacksmc.repository.EmailNotificationProfileRepository;
import com.hacksmc.repository.NotificationSettingsRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.internet.MimeMessage;
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
    private final RestClient restClient;

    public NotificationService(NotificationSettingsRepository notifRepo,
                                EmailNotificationProfileRepository emailProfileRepo,
                                MaintenanceService maintenanceService) {
        this.notifRepo = notifRepo;
        this.emailProfileRepo = emailProfileRepo;
        this.maintenanceService = maintenanceService;
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

            // Email notifications
            JavaMailSenderImpl mailSender = maintenanceService.buildMailSender(settings);
            if (mailSender != null) {
                String fromAddr = settings.getMailFrom() != null ? settings.getMailFrom() : settings.getMailUsername();
                // Legacy per-user settings
                List<NotificationSettings> eligible = notifRepo.findAllWithEmailEnabled();
                for (NotificationSettings ns : eligible) {
                    if (!shouldNotify(ns, action, hostId, actorUsername)) continue;
                    sendEmail(mailSender, fromAddr, ns.getEmail(), subject, body);
                }
                // Email notification profiles
                Long actorUserId = rule.getUser().getId();
                List<EmailNotificationProfile> profiles = emailProfileRepo.findAllByOrderByCreatedAtAsc();
                for (EmailNotificationProfile p : profiles) {
                    if (!shouldNotifyProfile(p, action, actorUserId)) continue;
                    sendEmail(mailSender, fromAddr, p.getEmail(), subject, body);
                }
            }

            // Discord webhook
            String webhookUrl = settings.getDiscordWebhookUrl();
            if (settings.isDiscordEnabled() && webhookUrl != null && !webhookUrl.isBlank()
                    && webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
                boolean shouldSend = ("CREATED".equals(action) && settings.isDiscordNotifyCreate())
                        || ("DELETED".equals(action) && settings.isDiscordNotifyDelete())
                        || ("EXPIRED".equals(action) && settings.isDiscordNotifyExpire());
                if (shouldSend) {
                    sendDiscord(webhookUrl, action, rule, hostName, portStr, actorUsername);
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

    private void sendEmail(JavaMailSenderImpl sender, String from, String to, String subject, String html) {
        try {
            MimeMessage msg = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(msg, false, "UTF-8");
            if (from != null && !from.isBlank()) helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(html, true);
            sender.send(msg);
            log.info("Email sent to {}: {}", to, subject);
        } catch (Exception e) {
            log.warn("Failed to send email to {}: {}", to, e.getMessage());
        }
    }

    private String buildEmailBody(String action, NatRule rule, String hostName, String portStr, String actor) {
        String accentColor = switch (action) {
            case "CREATED" -> "#00B0F4";
            case "DELETED" -> "#ED4245";
            case "EXPIRED" -> "#FEA832";
            default        -> "#6B7280";
        };
        String actionLabel = switch (action) {
            case "CREATED" -> "Regel erstellt";
            case "DELETED" -> "Regel gelöscht";
            case "EXPIRED" -> "Regel abgelaufen";
            default        -> action;
        };
        String icon = switch (action) {
            case "CREATED" -> "&#10003;";
            case "DELETED" -> "&#128465;";
            case "EXPIRED" -> "&#9200;";
            default        -> "&#8226;";
        };
        String description = rule.getDescription() != null && !rule.getDescription().isBlank()
                ? rule.getDescription() : "—";
        String expiry = rule.getExpiresAt() != null
                ? java.time.format.DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm")
                        .withZone(java.time.ZoneId.of("Europe/Berlin"))
                        .format(rule.getExpiresAt())
                : "—";

        return String.format("""
                <!DOCTYPE html>
                <html lang="de">
                <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
                <body style="margin:0;padding:0;background:#0f1117;font-family:'Helvetica Neue',Arial,sans-serif;">
                  <table width="100%%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:40px 16px;">
                    <tr><td align="center">
                      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%%;">

                        <!-- Header -->
                        <tr>
                          <td style="padding:0 0 24px 0;">
                            <table width="100%%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="font-family:'Courier New',monospace;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.05em;">
                                  Hack<span style="color:%s;">SMC</span>
                                </td>
                                <td align="right" style="font-family:'Courier New',monospace;font-size:11px;color:#4b5563;letter-spacing:0.08em;">
                                  NAT MANAGEMENT PORTAL
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>

                        <!-- Card -->
                        <tr>
                          <td style="background:#1a1d27;border:1px solid #2a2d3a;border-radius:8px;overflow:hidden;">

                            <!-- Status Bar -->
                            <tr>
                              <td style="background:%s;padding:4px 20px;">
                                &nbsp;
                              </td>
                            </tr>

                            <!-- Card Content -->
                            <tr>
                              <td style="padding:28px 28px 24px;">

                                <!-- Title -->
                                <p style="margin:0 0 4px;font-family:'Courier New',monospace;font-size:11px;color:#6b7280;letter-spacing:0.1em;text-transform:uppercase;">
                                  Ereignis
                                </p>
                                <h1 style="margin:0 0 24px;font-size:22px;font-weight:600;color:#ffffff;">
                                  <span style="color:%s;margin-right:8px;">%s</span>%s
                                </h1>

                                <!-- Details Table -->
                                <table width="100%%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                                  <tr>
                                    <td style="padding:10px 0;border-bottom:1px solid #2a2d3a;width:35%%;">
                                      <span style="font-family:'Courier New',monospace;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Host</span>
                                    </td>
                                    <td style="padding:10px 0;border-bottom:1px solid #2a2d3a;">
                                      <span style="font-size:14px;color:#e5e7eb;font-weight:500;">%s</span>
                                      <span style="font-family:'Courier New',monospace;font-size:12px;color:#4b5563;margin-left:8px;">%s</span>
                                    </td>
                                  </tr>
                                  <tr>
                                    <td style="padding:10px 0;border-bottom:1px solid #2a2d3a;">
                                      <span style="font-family:'Courier New',monospace;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Protokoll</span>
                                    </td>
                                    <td style="padding:10px 0;border-bottom:1px solid #2a2d3a;">
                                      <span style="font-family:'Courier New',monospace;font-size:13px;color:#e5e7eb;background:#2a2d3a;padding:2px 8px;border-radius:4px;">%s</span>
                                    </td>
                                  </tr>
                                  <tr>
                                    <td style="padding:10px 0;border-bottom:1px solid #2a2d3a;">
                                      <span style="font-family:'Courier New',monospace;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Port(s)</span>
                                    </td>
                                    <td style="padding:10px 0;border-bottom:1px solid #2a2d3a;">
                                      <span style="font-family:'Courier New',monospace;font-size:14px;color:%s;font-weight:600;">%s</span>
                                    </td>
                                  </tr>
                                  <tr>
                                    <td style="padding:10px 0;border-bottom:1px solid #2a2d3a;">
                                      <span style="font-family:'Courier New',monospace;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Benutzer</span>
                                    </td>
                                    <td style="padding:10px 0;border-bottom:1px solid #2a2d3a;">
                                      <span style="font-size:14px;color:#e5e7eb;">%s</span>
                                    </td>
                                  </tr>
                                  <tr>
                                    <td style="padding:10px 0;border-bottom:1px solid #2a2d3a;">
                                      <span style="font-family:'Courier New',monospace;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Beschreibung</span>
                                    </td>
                                    <td style="padding:10px 0;border-bottom:1px solid #2a2d3a;">
                                      <span style="font-size:14px;color:#9ca3af;">%s</span>
                                    </td>
                                  </tr>
                                  <tr>
                                    <td style="padding:10px 0;">
                                      <span style="font-family:'Courier New',monospace;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Ablauf</span>
                                    </td>
                                    <td style="padding:10px 0;">
                                      <span style="font-family:'Courier New',monospace;font-size:13px;color:#9ca3af;">%s</span>
                                    </td>
                                  </tr>
                                </table>

                              </td>
                            </tr>

                          </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                          <td style="padding:20px 0 0;text-align:center;">
                            <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;color:#374151;">
                              HackSMC &bull; Diese Nachricht wurde automatisch generiert &bull; Regel-ID #%d
                            </p>
                          </td>
                        </tr>

                      </table>
                    </td></tr>
                  </table>
                </body>
                </html>
                """,
                accentColor,
                accentColor,
                accentColor, icon, actionLabel,
                hostName, rule.getHost().getIpAddress(),
                rule.getProtocol(),
                accentColor, portStr,
                actor,
                description,
                expiry,
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
