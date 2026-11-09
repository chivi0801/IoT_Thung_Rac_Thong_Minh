package com.smartbin.service;

import java.time.Instant;
import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.smartbin.websocket.IoTTelescopeWebSocketHandler;

import com.fasterxml.jackson.core.JacksonException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * High level helper for pushing standardized events to all connected
 * dashboards through the WebSocket gateway.
 */
@Service
public class WebSocketBroadcastService {

    private static final Logger log = LoggerFactory.getLogger(WebSocketBroadcastService.class);

    private final IoTTelescopeWebSocketHandler webSocketHandler;
    private final ObjectMapper objectMapper;

    public WebSocketBroadcastService(IoTTelescopeWebSocketHandler webSocketHandler,
                                     ObjectMapper objectMapper) {
        this.webSocketHandler = webSocketHandler;
        this.objectMapper = objectMapper;
    }

    /**
     * Broadcasts a standardized envelope: {@code {"type", "payload", "timestamp"}}.
     *
     * @param eventType logical event name, for example {@code TELEMETRY}
     * @param data      payload object, serialized through Jackson
     */
    public void broadcast(String eventType, Object data) {
        if (eventType == null || eventType.isBlank()) {
            throw new IllegalArgumentException("eventType must not be blank");
        }

        ObjectNode envelope = objectMapper.createObjectNode();
        envelope.put("type", eventType);
        if (data == null) {
            envelope.putNull("payload");
        } else {
            envelope.set("payload", objectMapper.valueToTree(data));
        }
        envelope.put("timestamp", Instant.now().toString());

        send(envelope, eventType);
    }

    /**
     * Broadcasts a console line formatted for the UI terminal, for example
     * {@code [SYSTEM] Server started} or {@code [ESP32-S3] RSSI=-62}.
     *
     * @param tag     console source tag such as SYSTEM, ESP32-S3 or ACTUATOR
     * @param message human-readable log message
     */
    public void broadcastRawLog(String tag, String message) {
        String normalizedTag = (tag == null || tag.isBlank())
                ? "SYSTEM"
                : tag.trim().toUpperCase(Locale.ROOT);
        String line = "[" + normalizedTag + "] " + (message == null ? "" : message);

        ObjectNode envelope = objectMapper.createObjectNode();
        envelope.put("type", "CONSOLE_LOG");
        envelope.put("tag", normalizedTag);
        envelope.put("message", line);
        envelope.put("payload", line);
        envelope.put("timestamp", Instant.now().toString());

        send(envelope, "CONSOLE_LOG");
    }

    private void send(ObjectNode envelope, String eventType) {
        try {
            String json = objectMapper.writeValueAsString(envelope);
            webSocketHandler.broadcast(json);
        } catch (JacksonException e) {
            log.error("Failed to serialize WebSocket event '{}'", eventType, e);
        }
    }
}
