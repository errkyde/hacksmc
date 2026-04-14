package com.hacksmc.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Manages SSE connections for the topology screen.
 * Call {@link #broadcast(String, String, String)} after any topology mutation to push a
 * "topology_changed" event to all connected browser tabs, with actor attribution.
 */
@Service
@Slf4j
public class TopologyBroadcastService {

    private final Set<SseEmitter> emitters = ConcurrentHashMap.newKeySet();

    /**
     * Registers a new SSE subscriber. The emitter has no server-side timeout —
     * the 25-second heartbeat keeps proxies alive. Sends an immediate "connected"
     * event with the current online count.
     */
    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(0L);
        emitters.add(emitter);
        emitter.onCompletion(() -> { emitters.remove(emitter); broadcastOnlineCount(); });
        emitter.onTimeout(() -> { emitters.remove(emitter); broadcastOnlineCount(); });
        emitter.onError(e -> emitters.remove(emitter));

        try {
            emitter.send(SseEmitter.event()
                    .name("connected")
                    .data(Map.of("ts", Instant.now().toString(), "onlineCount", emitters.size()),
                            MediaType.APPLICATION_JSON));
        } catch (IOException e) {
            emitters.remove(emitter);
            return emitter;
        }

        // Notify existing subscribers that someone joined
        broadcastOnlineCount();
        log.debug("SSE subscriber joined, total={}", emitters.size());
        return emitter;
    }

    /**
     * Broadcasts a topology_changed event with actor attribution.
     *
     * @param actor  username who made the change (null → "system")
     * @param action action constant, e.g. DEVICE_CREATED
     * @param entity human-readable entity name / count string
     */
    public void broadcast(String actor, String action, String entity) {
        if (emitters.isEmpty()) return;
        Map<String, Object> payload = new HashMap<>();
        payload.put("actor", actor != null ? actor : "system");
        payload.put("action", action);
        if (entity != null) payload.put("entity", entity);
        payload.put("ts", Instant.now().toString());
        payload.put("onlineCount", emitters.size());

        send("topology_changed", payload);
        log.debug("SSE broadcast: actor={} action={} entity={}", actor, action, entity);
    }

    /** Pushes an online_count update to all subscribers without a topology change. */
    private void broadcastOnlineCount() {
        if (emitters.isEmpty()) return;
        send("online_count", Map.of("onlineCount", emitters.size(), "ts", Instant.now().toString()));
    }

    /** Heartbeat every 25 s — keeps connections alive through HAProxy / Nginx (30 s idle timeout). */
    @Scheduled(fixedRate = 25_000)
    public void heartbeat() {
        if (emitters.isEmpty()) return;
        send("heartbeat", Map.of("onlineCount", emitters.size(), "ts", Instant.now().toString()));
    }

    private void send(String eventName, Object payload) {
        Set<SseEmitter> dead = ConcurrentHashMap.newKeySet();
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name(eventName).data(payload, MediaType.APPLICATION_JSON));
            } catch (Exception e) {
                dead.add(emitter);
            }
        }
        emitters.removeAll(dead);
    }
}
