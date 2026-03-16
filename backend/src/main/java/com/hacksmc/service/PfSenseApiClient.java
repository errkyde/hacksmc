package com.hacksmc.service;

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
import java.time.Instant;
import java.security.cert.X509Certificate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

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

    /** Tag format embedded in pfSense rule descriptions. */
    private static final String TAG_PREFIX = "[hsmc:";
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
                : new JdkClientHttpRequestFactory(HttpClient.newBuilder().build());

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
    public String createNatRule(String destIp, String protocol, int port, String hostname, String userDescription, Long dbRuleId) {
        String tag = TAG_PREFIX + dbRuleId + TAG_SUFFIX;
        String descr = "<" + hostname + "> : " + tag + " - " + userDescription;

        log.info("Creating pfSense NAT rule: {}:{}/{} descr={}", destIp, port, protocol, descr);

        Map<String, Object> body = new HashMap<>();
        body.put("interface", "wan");
        body.put("ipprotocol", "inet");
        body.put("protocol", protocol.toLowerCase());
        body.put("source", "any");
        body.put("destination", "any");
        body.put("destination_port", String.valueOf(port));
        body.put("target", destIp);
        body.put("local_port", String.valueOf(port));
        body.put("descr", descr);
        body.put("disabled", false);
        body.put("associated_rule_id", "add");

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
     * Returns a map of hsmc-id → array index for all pfSense NAT rules that contain our tag.
     * Used for reconciliation and sync.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Integer> getHsmcRulePositions() {
        List<Map<String, Object>> pfRules = fetchAllNatRules();
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
        Map<String, Integer> positions = getHsmcRulePositions();
        Integer idx = positions.get(hsmcId);
        if (idx == null) {
            throw new PfSenseException("NAT-Regel [hsmc:" + hsmcId + "] nicht in pfSense gefunden", null);
        }
        return idx;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> fetchAllNatRules() {
        Map<String, Object> response;
        try {
            response = restClient.get()
                    .uri("/api/v2/firewall/nat/port_forwards")
                    .retrieve()
                    .body(Map.class);
        } catch (Exception e) {
            log.error("pfSense fetchAllNatRules failed — {}: {}", e.getClass().getSimpleName(), e.getMessage());
            throw new PfSenseException(humanReadable(e), e);
        }
        if (response == null || !response.containsKey("data")) {
            return List.of();
        }
        return (List<Map<String, Object>>) response.get("data");
    }

    /** Extracts the numeric ID from a description containing "[hsmc:X]", or null if absent. */
    static String extractHsmcId(String descr) {
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
                    .build();

            log.warn("pfSense client: trust-all-certs is enabled — use only in development!");
            return new JdkClientHttpRequestFactory(httpClient);
        } catch (Exception e) {
            throw new RuntimeException("Failed to create trust-all SSL context", e);
        }
    }
}
