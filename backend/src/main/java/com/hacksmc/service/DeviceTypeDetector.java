package com.hacksmc.service;

import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.List;

/**
 * Infers a network device type from its open ports and optional pfSense base URL.
 * Evaluated in priority order — first matching rule wins.
 */
@Component
public class DeviceTypeDetector {

    public String detect(String ipAddress, List<Integer> openPorts, String pfSenseBaseUrl) {
        if (openPorts == null) openPorts = List.of();

        // JetDirect printer port
        if (openPorts.contains(9100)) return "PRINTER";

        // SNMP + SSH/Telnet → managed switch
        if (openPorts.contains(161) && (openPorts.contains(22) || openPorts.contains(23))) return "SWITCH";

        // SNMP + Web UI → router/gateway
        if (openPorts.contains(161) && (openPorts.contains(80) || openPorts.contains(443))) return "ROUTER";

        // Matches the pfSense host → firewall
        if (matchesPfSense(ipAddress, pfSenseBaseUrl)) return "FIREWALL";

        // SSH or web service → generic host/server
        if (openPorts.contains(22) || openPorts.contains(80) || openPorts.contains(443)) return "HOST";

        // Windows RDP → Windows server/workstation (also HOST)
        if (openPorts.contains(3389)) return "HOST";

        // No ports open (ICMP only)
        if (openPorts.isEmpty()) return "UNKNOWN";

        return "HOST";
    }

    private boolean matchesPfSense(String ipAddress, String pfSenseBaseUrl) {
        if (ipAddress == null || pfSenseBaseUrl == null || pfSenseBaseUrl.isBlank()) return false;
        try {
            String pfSenseHost = URI.create(pfSenseBaseUrl).getHost();
            return ipAddress.equals(pfSenseHost);
        } catch (Exception e) {
            return false;
        }
    }
}
