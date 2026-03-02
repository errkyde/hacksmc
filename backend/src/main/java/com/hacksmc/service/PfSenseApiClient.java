package com.hacksmc.service;

import com.hacksmc.dto.PfSenseStatusResponse;
import com.hacksmc.exception.PfSenseException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.security.cert.X509Certificate;
import java.util.HashMap;
import java.util.Map;

@Service
@Slf4j
public class PfSenseApiClient {

    private final RestClient restClient;
    private final String baseUrl;

    public PfSenseApiClient(
            @Value("${hacksmc.pfsense.base-url}") String baseUrl,
            @Value("${hacksmc.pfsense.api-key}") String apiKey,
            @Value("${hacksmc.pfsense.trust-all-certs:false}") boolean trustAllCerts) {

        this.baseUrl = baseUrl;

        RestClient.Builder builder = RestClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader("X-API-Key", apiKey)
                .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE);

        if (trustAllCerts) {
            builder.requestFactory(trustAllCertsRequestFactory());
        }

        this.restClient = builder.build();
    }

    /**
     * Creates a NAT port-forward rule on pfSense.
     * Returns the pfSense-assigned rule ID.
     */
    public String createNatRule(String destIp, String protocol, int port, String description) {
        log.info("Creating pfSense NAT rule: {}:{}/{} -> {}", destIp, port, protocol, description);

        Map<String, Object> body = new HashMap<>();
        body.put("interface", "wan");
        body.put("ipprotocol", "inet");
        body.put("protocol", protocol.toLowerCase());
        body.put("source", "any");
        body.put("source_port", "any");
        body.put("destination", "any");
        body.put("destination_port", String.valueOf(port));
        body.put("target", destIp);
        body.put("local_port", String.valueOf(port));
        body.put("descr", description);
        body.put("disabled", false);
        body.put("associated_rule_id", "");

        @SuppressWarnings("unchecked")
        Map<String, Object> response;
        try {
            response = restClient.post()
                    .uri("/api/firewall/nat/port_forward")
                    .body(body)
                    .retrieve()
                    .body(Map.class);
        } catch (Exception e) {
            throw new PfSenseException(humanReadable(e), e);
        }

        if (response == null || !response.containsKey("data")) {
            throw new PfSenseException("Unerwartete Antwort von pfSense (kein 'data'-Feld)", null);
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) response.get("data");
        return String.valueOf(data.get("tracker"));
    }

    /**
     * Deletes a NAT rule from pfSense by its rule ID.
     */
    public void deleteNatRule(String pfSenseRuleId) {
        log.info("Deleting pfSense NAT rule: {}", pfSenseRuleId);
        try {
            restClient.delete()
                    .uri("/api/firewall/nat/port_forward/" + pfSenseRuleId)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
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
     * Quick connectivity check against pfSense. Returns UP/DOWN with latency.
     */
    public PfSenseStatusResponse checkHealth() {
        if (baseUrl == null || baseUrl.isBlank()) {
            return new PfSenseStatusResponse("DOWN", null, baseUrl,
                    "PFSENSE_BASE_URL ist nicht konfiguriert");
        }
        if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
            return new PfSenseStatusResponse("DOWN", null, baseUrl,
                    "PFSENSE_BASE_URL muss mit https:// beginnen (aktuell: \"" + baseUrl + "\")");
        }
        long start = System.currentTimeMillis();
        try {
            restClient.get()
                    .uri("/api/system/status")
                    .retrieve()
                    .toBodilessEntity();
            return new PfSenseStatusResponse("UP", System.currentTimeMillis() - start, baseUrl, null);
        } catch (Exception e) {
            log.warn("pfSense health check failed: {}", e.getMessage());
            return new PfSenseStatusResponse("DOWN", null, baseUrl, e.getMessage());
        }
    }

    private org.springframework.http.client.SimpleClientHttpRequestFactory trustAllCertsRequestFactory() {
        try {
            SSLContext sslContext = SSLContext.getInstance("TLS");
            sslContext.init(null, new TrustManager[]{new X509TrustManager() {
                public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
                public void checkClientTrusted(X509Certificate[] certs, String authType) {}
                public void checkServerTrusted(X509Certificate[] certs, String authType) {}
            }}, null);

            var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
            // Note: for production, configure a proper SSLContext with your CA cert instead
            log.warn("pfSense client: trust-all-certs is enabled — use only in development!");
            return factory;
        } catch (Exception e) {
            throw new RuntimeException("Failed to create trust-all SSL context", e);
        }
    }
}
