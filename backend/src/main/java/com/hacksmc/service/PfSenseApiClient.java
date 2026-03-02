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
                .defaultHeader("Authorization", "Bearer " + apiKey)
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

        var body = Map.of(
                "interface", "wan",
                "protocol", protocol.toLowerCase(),
                "src", "any",
                "srcport", "any",
                "dst", "any",
                "dstport", String.valueOf(port),
                "target", destIp,
                "local-port", String.valueOf(port),
                "descr", description,
                "enabled", true
        );

        @SuppressWarnings("unchecked")
        Map<String, Object> response;
        try {
            response = restClient.post()
                    .uri("/api/v1/firewall/nat/port_forward")
                    .body(body)
                    .retrieve()
                    .body(Map.class);
        } catch (Exception e) {
            throw new PfSenseException(e.getMessage(), e);
        }

        if (response == null || !response.containsKey("data")) {
            throw new PfSenseException("Unerwartete Antwort von pfSense", null);
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) response.get("data");
        return String.valueOf(data.get("id"));
    }

    /**
     * Deletes a NAT rule from pfSense by its rule ID.
     */
    public void deleteNatRule(String pfSenseRuleId) {
        log.info("Deleting pfSense NAT rule: {}", pfSenseRuleId);
        try {
            restClient.delete()
                    .uri("/api/v1/firewall/nat/port_forward?id=" + pfSenseRuleId)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            throw new PfSenseException(e.getMessage(), e);
        }
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
                    .uri("/api/v1/system/status")
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
