package com.hacksmc.service;

import com.hacksmc.dto.ArpEntryDto;
import com.hacksmc.dto.PfSenseStatusResponse;
import com.hacksmc.exception.PfSenseException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.time.Instant;
import java.security.cert.X509Certificate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Client for the pfSense REST API (pfrest.org v2).
 *
 * pfSense NAT port-forward rules have no persistent tracker field.
 * We embed a tag "[hsmc:{dbId}]" in every rule description so we can
 * reliably identify and locate our rules regardless of array-index shifts.
 */
@Service
@Slf4j
public class PfSenseApiClient {

    /** Tag format embedded in pfSense NAT rule descriptions. */
    private static final String TAG_PREFIX = "[hsmc:";
    /** Tag format embedded in pfSense firewall rule descriptions. */
    private static final String FW_TAG_PREFIX = "[hsmc-fw:";
    private static final String TAG_SUFFIX = "]";

    private final RestClient restClient;
    private final String baseUrl;

    private volatile PfSenseStatusResponse cachedStatus;
    private volatile Instant cacheExpiry = Instant.MIN;

    public PfSenseApiClient(
            @Value("${hacksmc.pfsense.base-url}") String baseUrl,
            @Value("${hacksmc.pfsense.api-key}") String apiKey,
            @Value("${hacksmc.pfsense.trust-all-certs:false}") boolean trustAllCerts) {

        this.baseUrl = baseUrl;

        JdkClientHttpRequestFactory requestFactory = trustAllCerts
                ? trustAllCertsRequestFactory()
                : buildRequestFactory(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build());

        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .defaultHeader("X-API-Key", apiKey)
                .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    /**
     * Creates a NAT port-forward rule on pfSense.
     * Embeds [hsmc:{dbRuleId}] in the description for reliable identification.
     * Stores the dbRuleId as pfSenseRuleId in the DB.
     */
    public String createNatRule(String destIp, String protocol, int portStart, int portEnd, String hostname, String userDescription, Long dbRuleId) {
        String tag = TAG_PREFIX + dbRuleId + TAG_SUFFIX;
        String descr = "<" + hostname + "> : " + tag + " - " + userDescription;
        String portStr = (portStart == portEnd) ? String.valueOf(portStart) : portStart + ":" + portEnd;

        log.info("Creating pfSense NAT rule: {}:{}/{} descr={}", destIp, portStr, protocol, descr);

        Map<String, Object> body = new HashMap<>();
        body.put("interface", "wan");
        body.put("ipprotocol", "inet");
        body.put("protocol", protocol.toLowerCase());
        body.put("source", "any");
        body.put("destination", "any");
        body.put("destination_port", portStr);
        body.put("target", destIp);
        body.put("local_port", portStr);
        body.put("descr", descr);
        body.put("disabled", false);
        body.put("associated_rule_id", "new");

        try {
            restClient.post()
                    .uri("/api/v2/firewall/nat/port_forward")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.error("pfSense createNatRule failed — {}: {}", e.getClass().getSimpleName(), e.getMessage());
            throw new PfSenseException(humanReadable(e), e);
        }

        applyChanges();

        // pfSenseRuleId = our own DB rule ID (used as the stable identifier via description tag)
        return String.valueOf(dbRuleId);
    }

    /**
     * Deletes a NAT rule from pfSense by its stored pfSenseRuleId (= our DB rule ID).
     * Locates the rule in pfSense by searching descriptions for [hsmc:{pfSenseRuleId}].
     */
    public void deleteNatRule(String pfSenseRuleId) {
        log.info("Deleting pfSense NAT rule with hsmc-id: {}", pfSenseRuleId);
        int arrayId = findArrayIdByHsmcId(pfSenseRuleId);
        log.info("Resolved hsmc-id {} to array index {}", pfSenseRuleId, arrayId);
        try {
            restClient.method(org.springframework.http.HttpMethod.DELETE)
                    .uri("/api/v2/firewall/nat/port_forward")
                    .body(Map.of("id", arrayId))
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.error("pfSense deleteNatRule failed — {}: {}", e.getClass().getSimpleName(), e.getMessage());
            throw new PfSenseException(humanReadable(e), e);
        }

        applyChanges();
    }

    /**
     * Creates an inbound firewall PASS rule on the given pfSense interface.
     * Source = any, destination = targetIp:port. Embeds [hsmc-fw:{connectionId}] in description.
     *
     * @param pfSenseInterface  the pfSense interface name (e.g. "opt1", "lan")
     * @param targetIp          destination IP address
     * @param protocol          "tcp", "udp", "icmp", or null → "any"
     * @param portStart         null → "any" for destination port
     * @param portEnd           null → same as portStart
     * @param connectionId      DB id of the NetworkConnection (stable tag)
     * @return String.valueOf(connectionId) as the stable firewallRuleId
     */
    public String createFirewallRule(String pfSenseInterface, String targetIp,
                                     String protocol, Integer portStart, Integer portEnd,
                                     Long connectionId) {
        String tag = FW_TAG_PREFIX + connectionId + TAG_SUFFIX;
        String descr = "[hsmc-fw] " + targetIp + " " + tag;

        String portStr = null;
        if (portStart != null) {
            int end = portEnd != null ? portEnd : portStart;
            portStr = portStart.equals(end) ? String.valueOf(portStart) : portStart + ":" + end;
        }

        log.info("Creating pfSense firewall rule: iface={} dst={}:{}/{} descr={}",
                pfSenseInterface, targetIp, portStr, protocol, descr);

        Map<String, Object> body = new HashMap<>();
        body.put("interface", pfSenseInterface);
        body.put("type", "pass");
        body.put("ipprotocol", "inet");
        body.put("protocol", protocol != null ? protocol.toLowerCase() : "any");
        body.put("src", "any");
        body.put("dst", targetIp);
        body.put("dstport", portStr != null ? portStr : "any");
        body.put("descr", descr);
        body.put("disabled", false);

        try {
            restClient.post()
                    .uri("/api/v2/firewall/rules")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.error("pfSense createFirewallRule failed — {}: {}", e.getClass().getSimpleName(), e.getMessage());
            throw new PfSenseException(humanReadable(e), e);
        }

        applyChanges();
        return String.valueOf(connectionId);
    }

    /**
     * Deletes a firewall rule from pfSense by its stored firewallRuleId (= our DB connection ID).
     * Locates the rule by searching descriptions for [hsmc-fw:{firewallRuleId}].
     */
    public void deleteFirewallRule(String firewallRuleId) {
        log.info("Deleting pfSense firewall rule with hsmc-fw-id: {}", firewallRuleId);
        int arrayId = findFwArrayIdByHsmcId(firewallRuleId);
        log.info("Resolved hsmc-fw-id {} to array index {}", firewallRuleId, arrayId);
        try {
            restClient.method(org.springframework.http.HttpMethod.DELETE)
                    .uri("/api/v2/firewall/rules")
                    .body(Map.of("id", arrayId))
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.error("pfSense deleteFirewallRule failed — {}: {}", e.getClass().getSimpleName(), e.getMessage());
            throw new PfSenseException(humanReadable(e), e);
        }
        applyChanges();
    }

    private int findFwArrayIdByHsmcId(String hsmcId) {
        List<Map<String, Object>> rules = fetchAllFirewallRules();
        for (int i = 0; i < rules.size(); i++) {
            String descr = (String) rules.get(i).get("descr");
            if (descr != null && descr.contains(FW_TAG_PREFIX + hsmcId + TAG_SUFFIX)) {
                return i;
            }
        }
        throw new PfSenseException("Firewall-Regel [hsmc-fw:" + hsmcId + "] nicht in pfSense gefunden", null);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> fetchAllFirewallRules() {
        Map<String, Object> response;
        try {
            response = restClient.get()
                    .uri("/api/v2/firewall/rules")
                    .retrieve()
                    .body(Map.class);
        } catch (Exception e) {
            log.error("pfSense fetchAllFirewallRules failed — {}: {}", e.getClass().getSimpleName(), e.getMessage());
            throw new PfSenseException(humanReadable(e), e);
        }
        if (response == null || !response.containsKey("data")) return List.of();
        return (List<Map<String, Object>>) response.get("data");
    }

    /**
     * Returns a map of hsmc-id → array index for all pfSense NAT rules that contain our tag.
     * Used for reconciliation and sync.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Integer> getHsmcRulePositions() {
        List<Map<String, Object>> pfRules = fetchAllNatPortForwardRules();
        Map<String, Integer> result = new HashMap<>();
        for (int i = 0; i < pfRules.size(); i++) {
            String descr = (String) pfRules.get(i).get("descr");
            String hsmcId = extractHsmcId(descr);
            if (hsmcId != null) {
                result.put(hsmcId, i);
            }
        }
        return result;
    }

    private int findArrayIdByHsmcId(String hsmcId) {
        Map<String, Integer> positions = getHsmcRulePositions(); // uses fetchAllNatPortForwardRules
        Integer idx = positions.get(hsmcId);
        if (idx == null) {
            throw new PfSenseException("NAT-Regel [hsmc:" + hsmcId + "] nicht in pfSense gefunden", null);
        }
        return idx;
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> fetchAllNatPortForwardRules() {
        Map<String, Object> response;
        try {
            response = restClient.get()
                    .uri("/api/v2/firewall/nat/port_forwards")
                    .retrieve()
                    .body(Map.class);
        } catch (Exception e) {
            log.error("pfSense fetchAllNatPortForwardRules failed — {}: {}", e.getClass().getSimpleName(), e.getMessage());
            throw new PfSenseException(humanReadable(e), e);
        }
        if (response == null || !response.containsKey("data")) return List.of();
        return (List<Map<String, Object>>) response.get("data");
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> fetchAllFirewallPassRules() {
        List<Map<String, Object>> all = fetchAllFirewallRules();
        log.info("fetchAllFirewallPassRules: {} total rules, first={}", all.size(),
                all.isEmpty() ? "none" : all.get(0));
        return all.stream()
                .filter(r -> {
                    Object t = r.get("type");
                    return "pass".equalsIgnoreCase(t != null ? t.toString() : null);
                })
                .toList();
    }

    /** Extracts the numeric ID from a description containing "[hsmc:X]", or null if absent. */
    public static String extractHsmcId(String descr) {
        if (descr == null) return null;
        int start = descr.indexOf(TAG_PREFIX);
        if (start == -1) return null;
        int end = descr.indexOf(TAG_SUFFIX, start + TAG_PREFIX.length());
        if (end == -1) return null;
        return descr.substring(start + TAG_PREFIX.length(), end);
    }

    private void applyChanges() {
        try {
            restClient.post()
                    .uri("/api/v2/firewall/apply")
                    .retrieve()
                    .toBodilessEntity();
            log.info("pfSense firewall changes applied");
        } catch (Exception e) {
            log.warn("pfSense apply failed — {}: {}", e.getClass().getSimpleName(), e.getMessage());
            throw new PfSenseException(humanReadable(e), e);
        }
    }

    private static String humanReadable(Exception e) {
        String msg = e.getMessage();
        if (msg == null) return "Unbekannter Fehler";
        if (msg.contains("text/html"))
            return "pfSense hat eine HTML-Seite zurückgegeben – API-Key oder URL prüfen";
        if (msg.contains("Connection refused"))
            return "Verbindung abgelehnt – PFSENSE_BASE_URL prüfen";
        if (msg.contains("UnknownHost") || msg.contains("unknown host"))
            return "Host nicht erreichbar – PFSENSE_BASE_URL prüfen";
        if (msg.contains("URI is not absolute") || msg.contains("not absolute"))
            return "PFSENSE_BASE_URL muss mit https:// beginnen";
        return msg;
    }

    /**
     * Fetches the ARP table from pfSense.
     * Returns entries with IP, MAC, interface, and optional hostname.
     */
    @SuppressWarnings("unchecked")
    public List<ArpEntryDto> fetchArpTable() {
        Map<String, Object> response;
        try {
            response = restClient.get()
                    .uri("/api/v2/diagnostics/arp_table")
                    .retrieve()
                    .body(Map.class);
        } catch (Exception e) {
            log.error("pfSense fetchArpTable failed — {}: {}", e.getClass().getSimpleName(), e.getMessage());
            throw new PfSenseException(humanReadable(e), e);
        }
        if (response == null) {
            log.warn("fetchArpTable: null response");
            return List.of();
        }
        log.info("fetchArpTable raw response keys: {}", response.keySet());

        // pfREST v2 can return either a direct list or a paginated wrapper
        Object dataRaw = response.get("data");
        if (dataRaw == null) {
            log.warn("fetchArpTable: 'data' key missing. Full response: {}", response);
            return List.of();
        }

        List<Map<String, Object>> entries;
        if (dataRaw instanceof List<?> list) {
            entries = (List<Map<String, Object>>) list;
        } else if (dataRaw instanceof Map<?, ?> dataMap) {
            // Paginated: { "items": [...], "total": N, "returned": N }
            Object items = ((Map<String, Object>) dataMap).get("items");
            if (items instanceof List<?> itemList) {
                entries = (List<Map<String, Object>>) itemList;
            } else {
                log.warn("fetchArpTable: unexpected paginated structure: {}", dataMap.keySet());
                return List.of();
            }
        } else {
            log.warn("fetchArpTable: unexpected data type: {}", dataRaw.getClass());
            return List.of();
        }

        if (entries.isEmpty()) {
            log.info("fetchArpTable: empty ARP table returned from pfSense");
            return List.of();
        }
        log.info("fetchArpTable: {} entries, first entry: {}", entries.size(), entries.get(0));

        return entries.stream().map(entry -> {
            // Handle field name variants across pfSense REST API versions
            String ip       = firstNonNull(entry, "ip_address", "ip", "ip_addr", "ipaddr");
            String mac      = firstNonNull(entry, "mac_address", "mac", "mac_addr", "macaddr");
            String iface    = firstNonNull(entry, "interface", "intf", "if");
            String hostname = firstNonNull(entry, "hostname", "host", "dnsresolve");
            // pfSense returns "?" when hostname is unknown — treat as empty
            if ("?".equals(hostname)) hostname = null;
            return new ArpEntryDto(ip, mac, iface, hostname);
        }).toList();
    }

    private static String firstNonNull(Map<String, Object> map, String... keys) {
        for (String key : keys) {
            Object val = map.get(key);
            if (val instanceof String s && !s.isBlank()) return s;
        }
        return null;
    }

    /**
     * Returns a map of pfSense interface internal name → human-readable description.
     * e.g. { "em0" → "WAN", "igb0" → "LAN", "opt1" → "VLAN10" }
     * Returns empty map on any error (non-critical, used for display only).
     */
    @SuppressWarnings("unchecked")
    public Map<String, String> fetchInterfaceNames() {
        try {
            Map<String, Object> response = restClient.get()
                    .uri("/api/v2/interface")
                    .retrieve()
                    .body(Map.class);
            if (response == null) return Map.of();
            Object dataRaw = response.get("data");
            List<Map<String, Object>> interfaces;
            if (dataRaw instanceof List<?> list) {
                interfaces = (List<Map<String, Object>>) list;
            } else if (dataRaw instanceof Map<?, ?> dataMap) {
                Object items = ((Map<String, Object>) dataMap).get("items");
                interfaces = items instanceof List<?> il ? (List<Map<String, Object>>) il : List.of();
            } else return Map.of();

            Map<String, String> result = new HashMap<>();
            for (Map<String, Object> iface : interfaces) {
                String ifName = firstNonNull(iface, "if", "ifname", "id");
                String descr  = firstNonNull(iface, "descr", "description", "name");
                if (ifName != null) result.put(ifName, descr != null ? descr : ifName.toUpperCase());
            }
            log.info("Fetched {} pfSense interface names", result.size());
            return result;
        } catch (Exception e) {
            log.warn("Could not fetch pfSense interface list (non-critical): {}", e.getMessage());
            return Map.of();
        }
    }

    /**
     * Fetches the default WAN gateway IP from pfSense.
     * Returns the IP of the gateway marked as default (defaultgw=true),
     * or the first gateway on a WAN-like interface, or null if none found.
     */
    @SuppressWarnings("unchecked")
    public String fetchWanGatewayIp() {
        try {
            Map<String, Object> response = restClient.get()
                    .uri("/api/v2/routing/gateway")
                    .retrieve()
                    .body(Map.class);
            if (response == null) return null;

            Object dataRaw = response.get("data");
            List<Map<String, Object>> gateways;
            if (dataRaw instanceof List<?> list) {
                gateways = (List<Map<String, Object>>) list;
            } else if (dataRaw instanceof Map<?, ?> dataMap) {
                Object items = ((Map<String, Object>) dataMap).get("items");
                gateways = items instanceof List<?> il ? (List<Map<String, Object>>) il : List.of();
            } else return null;

            if (gateways.isEmpty()) return null;

            // Prefer the gateway explicitly marked as default
            for (Map<String, Object> gw : gateways) {
                Object defRaw = gw.get("defaultgw");
                if (defRaw == null) defRaw = gw.get("default");
                if (Boolean.TRUE.equals(defRaw) || "true".equalsIgnoreCase(String.valueOf(defRaw))) {
                    String ip = firstNonNull(gw, "gateway", "gw", "nexthop");
                    if (ip != null && !ip.isBlank() && !"dynamic".equalsIgnoreCase(ip)) {
                        log.info("WAN gateway (default): {}", ip);
                        return ip;
                    }
                }
            }

            // Fallback: first gateway on a WAN-like interface
            for (Map<String, Object> gw : gateways) {
                String iface = firstNonNull(gw, "interface", "friendlyiface", "if");
                if (iface != null && (iface.equalsIgnoreCase("wan")
                        || iface.toLowerCase().startsWith("em0")
                        || iface.toLowerCase().startsWith("igb0")
                        || iface.toLowerCase().startsWith("re0"))) {
                    String ip = firstNonNull(gw, "gateway", "gw", "nexthop");
                    if (ip != null && !ip.isBlank() && !"dynamic".equalsIgnoreCase(ip)) {
                        log.info("WAN gateway (by interface {}): {}", iface, ip);
                        return ip;
                    }
                }
            }

            // Last resort: first gateway with a valid IP
            for (Map<String, Object> gw : gateways) {
                String ip = firstNonNull(gw, "gateway", "gw", "nexthop");
                if (ip != null && !ip.isBlank() && !"dynamic".equalsIgnoreCase(ip)) {
                    log.info("WAN gateway (first available): {}", ip);
                    return ip;
                }
            }

            return null;
        } catch (Exception e) {
            log.warn("Could not fetch pfSense WAN gateway (non-critical): {}", e.getMessage());
            return null;
        }
    }

    /** Quick connectivity check against pfSense via TCP connect. Result cached for 5 minutes. */
    public PfSenseStatusResponse checkHealth() {
        if (Instant.now().isBefore(cacheExpiry) && cachedStatus != null) {
            return cachedStatus;
        }
        cachedStatus = doCheckHealth();
        cacheExpiry = Instant.now().plusSeconds(300);
        return cachedStatus;
    }

    private PfSenseStatusResponse doCheckHealth() {
        if (baseUrl == null || baseUrl.isBlank()) {
            return new PfSenseStatusResponse("DOWN", null, baseUrl,
                    "PFSENSE_BASE_URL ist nicht konfiguriert");
        }
        if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
            return new PfSenseStatusResponse("DOWN", null, baseUrl,
                    "PFSENSE_BASE_URL muss mit https:// beginnen (aktuell: \"" + baseUrl + "\")");
        }
        try {
            URI uri = URI.create(baseUrl);
            String host = uri.getHost();
            int port = uri.getPort() != -1 ? uri.getPort()
                    : baseUrl.startsWith("https://") ? 443 : 80;
            long start = System.currentTimeMillis();
            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(host, port), 3000);
            }
            return new PfSenseStatusResponse("UP", System.currentTimeMillis() - start, baseUrl, null);
        } catch (IOException e) {
            log.warn("pfSense health check failed: {}", e.getMessage());
            return new PfSenseStatusResponse("DOWN", null, baseUrl, e.getMessage());
        }
    }

    private static JdkClientHttpRequestFactory buildRequestFactory(HttpClient httpClient) {
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(Duration.ofSeconds(10));
        return factory;
    }

    private JdkClientHttpRequestFactory trustAllCertsRequestFactory() {
        try {
            System.setProperty("jdk.internal.httpclient.disableHostnameVerification", "true");

            SSLContext sslContext = SSLContext.getInstance("TLS");
            sslContext.init(null, new TrustManager[]{new X509TrustManager() {
                public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
                public void checkClientTrusted(X509Certificate[] certs, String authType) {}
                public void checkServerTrusted(X509Certificate[] certs, String authType) {}
            }}, null);

            HttpClient httpClient = HttpClient.newBuilder()
                    .sslContext(sslContext)
                    .connectTimeout(Duration.ofSeconds(8))
                    .build();

            log.warn("pfSense client: trust-all-certs is enabled — use only in development!");
            return buildRequestFactory(httpClient);
        } catch (Exception e) {
            throw new RuntimeException("Failed to create trust-all SSL context", e);
        }
    }
}
