package com.hacksmc.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;

@Entity
@Table(name = "system_settings")
@Getter @Setter
public class SystemSettings {
    @Id private int id = 1;
    @Column(nullable = false) private boolean siteMaintenance = false;
    @Column(name = "pfsense_maintenance", nullable = false) private boolean pfSenseMaintenance = false;
    @Column(nullable = false, length = 500) private String siteMaintenanceMessage = "Die Plattform befindet sich im Wartungsmodus.";
    @Column(length = 1000) private String discordWebhookUrl;
    @Column(nullable = false) private boolean discordEnabled = false;
    @Column(nullable = false) private boolean discordNotifyCreate = true;
    @Column(nullable = false) private boolean discordNotifyDelete = true;
    @Column(nullable = false) private boolean discordNotifyExpire = true;
    @Column private String updatedBy;
    @Column private Instant updatedAt;
}
