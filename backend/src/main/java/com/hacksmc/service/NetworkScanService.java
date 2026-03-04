package com.hacksmc.service;

import com.hacksmc.dto.ScannedHostResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.*;

@Service
@Slf4j
public class NetworkScanService {

    private static final int TIMEOUT_MS = 800;
    private static final int MAX_HOSTS = 1024; // cap at /22

    public List<ScannedHostResult> scan(String cidr) {
        long[] range = parseCidr(cidr);
        long start = range[0] + 1; // skip network address
        long end   = range[1] - 1; // skip broadcast

        long count = end - start + 1;
        if (count > MAX_HOSTS) {
            throw new IllegalArgumentException("Subnet too large (max /" + bitsForCount(MAX_HOSTS) + ")");
        }

        int threads = (int) Math.min(count, 64);
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        List<Future<ScannedHostResult>> futures = new ArrayList<>();

        for (long ip = start; ip <= end; ip++) {
            final String ipStr = longToIp(ip);
            futures.add(pool.submit(() -> probe(ipStr)));
        }

        pool.shutdown();
        try {
            pool.awaitTermination(30, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        List<ScannedHostResult> results = new ArrayList<>();
        for (Future<ScannedHostResult> f : futures) {
            try {
                ScannedHostResult r = f.get();
                if (r != null) results.add(r);
            } catch (Exception ignored) {}
        }

        results.sort(Comparator.comparingLong(r -> ipToLong(r.getIpAddress())));
        return results;
    }

    private ScannedHostResult probe(String ip) {
        long t0 = System.currentTimeMillis();

        // ICMP first
        try {
            InetAddress addr = InetAddress.getByName(ip);
            if (addr.isReachable(TIMEOUT_MS)) {
                int latency = (int) (System.currentTimeMillis() - t0);
                String hostname = resolveHostname(addr, ip);
                return new ScannedHostResult(ip, hostname, latency);
            }
        } catch (Exception ignored) {}

        // TCP fallback on common ports
        for (int port : new int[]{22, 80, 443, 8080, 3389}) {
            try (Socket s = new Socket()) {
                s.connect(new InetSocketAddress(ip, port), TIMEOUT_MS);
                int latency = (int) (System.currentTimeMillis() - t0);
                InetAddress addr = InetAddress.getByName(ip);
                String hostname = resolveHostname(addr, ip);
                return new ScannedHostResult(ip, hostname, latency);
            } catch (Exception ignored) {}
        }

        return null;
    }

    private String resolveHostname(InetAddress addr, String ip) {
        try {
            String name = addr.getCanonicalHostName();
            return name.equals(ip) ? null : name;
        } catch (Exception e) {
            return null;
        }
    }

    /** Returns [networkAddress, broadcastAddress] as longs */
    private long[] parseCidr(String cidr) {
        String[] parts = cidr.split("/");
        long ip = ipToLong(parts[0]);
        int prefix = Integer.parseInt(parts[1]);
        if (prefix < 8 || prefix > 30) {
            throw new IllegalArgumentException("Prefix length must be between 8 and 30");
        }
        long mask = prefix == 0 ? 0L : (0xFFFFFFFFL << (32 - prefix)) & 0xFFFFFFFFL;
        long network = ip & mask;
        long broadcast = network | (~mask & 0xFFFFFFFFL);
        return new long[]{network, broadcast};
    }

    private long ipToLong(String ip) {
        String[] parts = ip.split("\\.");
        return (Long.parseLong(parts[0]) << 24)
             | (Long.parseLong(parts[1]) << 16)
             | (Long.parseLong(parts[2]) << 8)
             |  Long.parseLong(parts[3]);
    }

    private String longToIp(long ip) {
        return ((ip >> 24) & 0xFF) + "." + ((ip >> 16) & 0xFF) + "." + ((ip >> 8) & 0xFF) + "." + (ip & 0xFF);
    }

    private int bitsForCount(int count) {
        return 32 - (int) (Math.log(count) / Math.log(2));
    }
}
