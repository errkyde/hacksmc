package com.hacksmc.service;

import com.hacksmc.entity.Host;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class HostPingService {

    private static final int TIMEOUT_MS = 2000;

    public Map<Long, Boolean> checkHosts(List<Host> hosts) {
        Map<Long, Boolean> result = new HashMap<>();
        for (Host host : hosts) {
            result.put(host.getId(), isReachable(host.getIpAddress()));
        }
        return result;
    }

    private boolean isReachable(String ip) {
        // Try ICMP first, fall back to TCP port 7 (echo) or 22 (SSH)
        try {
            InetAddress addr = InetAddress.getByName(ip);
            if (addr.isReachable(TIMEOUT_MS)) {
                return true;
            }
        } catch (Exception e) {
            log.debug("ICMP unreachable for {}: {}", ip, e.getMessage());
        }
        // TCP fallback — try port 22 (SSH) or 80
        for (int port : new int[]{22, 80, 443}) {
            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(ip, port), TIMEOUT_MS);
                return true;
            } catch (Exception ignored) {
            }
        }
        return false;
    }
}
