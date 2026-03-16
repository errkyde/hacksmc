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
import java.util.concurrent.*;

@Service
@Slf4j
public class HostPingService {

    private static final int TIMEOUT_MS = 2000;

    public Map<Long, Boolean> checkHosts(List<Host> hosts) {
        if (hosts.isEmpty()) return Map.of();
        ExecutorService pool = Executors.newFixedThreadPool(Math.min(hosts.size(), 32));
        Map<Long, Future<Boolean>> futures = new HashMap<>();
        for (Host host : hosts) {
            futures.put(host.getId(), pool.submit(() -> isReachable(host.getIpAddress())));
        }
        pool.shutdown();
        try { pool.awaitTermination(10, TimeUnit.SECONDS); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        Map<Long, Boolean> result = new HashMap<>();
        futures.forEach((id, f) -> { try { result.put(id, f.get()); } catch (Exception e) { result.put(id, false); } });
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
