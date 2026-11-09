package com.smartbin.websocket;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * Real-time WebSocket gateway for ESP32-S3 telemetry, heartbeats and the
 * web dashboard terminal.
 *
 * <p>Sessions are kept in a {@link ConcurrentHashMap}. Outbound frames are
 * wrapped in a {@link ConcurrentWebSocketSessionDecorator} because a raw
 * {@link WebSocketSession} does not support concurrent sends.</p>
 */
@Component
public class IoTTelescopeWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(IoTTelescopeWebSocketHandler.class);

    private static final int SEND_TIME_LIMIT_MS = 10_000;
    private static final int BUFFER_SIZE_LIMIT_BYTES = 512 * 1024;

    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;

    public IoTTelescopeWebSocketHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        WebSocketSession safeSession = new ConcurrentWebSocketSessionDecorator(
                session, SEND_TIME_LIMIT_MS, BUFFER_SIZE_LIMIT_BYTES);
        sessions.put(session.getId(), safeSession);

        log.info("WebSocket connected: id={}, remote={}, activeSessions={}",
                session.getId(), session.getRemoteAddress(), sessions.size());

        ObjectNode handshake = objectMapper.createObjectNode();
        handshake.put("type", "CONNECTION_ESTABLISHED");
        handshake.put("message", "Handshake OK with Spring Boot Server");
        handshake.put("timestamp", Instant.now().toString());

        sendToSession(safeSession, handshake.toString());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        WebSocketSession removed = sessions.remove(session.getId());
        if (removed != null) {
            log.info("WebSocket closed: id={}, status={}, activeSessions={}",
                    session.getId(), status, sessions.size());
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        String payload = message.getPayload();
        if (payload == null || payload.isBlank()) {
            return;
        }

        JsonNode incoming = tryParse(payload);
        if (incoming == null) {
            log.debug("Plain-text frame from {}: {}", session.getId(), payload);
            broadcast(buildEnvelope("CLIENT_MESSAGE", payload).toString());
            return;
        }

        if (isPing(incoming, payload)) {
            handlePing(session, incoming);
            return;
        }

        if (isTelemetry(incoming)) {
            handleTelemetry(session, incoming);
            return;
        }

        log.debug("Unclassified frame from {}: {}", session.getId(), payload);
        broadcastExcept(session.getId(), payload);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        String sessionId = session != null ? session.getId() : "unknown";
        log.error("WebSocket transport error on session {}: {}",
                sessionId, exception.getMessage(), exception);

        if (session != null) {
            sessions.remove(session.getId());
            closeQuietly(session);
        }
    }

    /**
     * Broadcasts an already serialized JSON payload to every open session.
     *
     * @param jsonPayload JSON text to send
     */
    public void broadcast(String jsonPayload) {
        if (jsonPayload == null || jsonPayload.isBlank()) {
            return;
        }
        TextMessage textMessage = new TextMessage(jsonPayload);
        sessions.forEach((id, session) -> {
            if (session.isOpen()) {
                sendToSession(session, textMessage);
            } else {
                sessions.remove(id, session);
            }
        });
    }

    public int getActiveSessionCount() {
        return sessions.size();
    }

    private void handlePing(WebSocketSession session, JsonNode incoming) {
        ObjectNode pong = objectMapper.createObjectNode();
        pong.put("type", "PONG");
        pong.put("message", "Heartbeat acknowledged");
        pong.put("timestamp", Instant.now().toString());
        if (incoming.has("timestamp")) {
            pong.set("clientTimestamp", incoming.get("timestamp"));
        }

        WebSocketSession target = sessions.get(session.getId());
        sendToSession(target, pong.toString());
    }

    private void handleTelemetry(WebSocketSession session, JsonNode incoming) {
        ObjectNode envelope = objectMapper.createObjectNode();
        envelope.put("type", "TELEMETRY");
        envelope.set("payload", incoming);
        envelope.put("sourceSessionId", session.getId());
        envelope.put("timestamp", Instant.now().toString());

        broadcastExcept(session.getId(), envelope.toString());

        ObjectNode acknowledgement = objectMapper.createObjectNode();
        acknowledgement.put("type", "TELEMETRY_ACK");
        acknowledgement.put("message", "Telemetry received");
        acknowledgement.put("timestamp", Instant.now().toString());
        WebSocketSession target = sessions.get(session.getId());
        sendToSession(target, acknowledgement.toString());
    }

    private boolean isPing(JsonNode node, String rawPayload) {
        String type = node.path("type").asString("");
        if ("PING".equalsIgnoreCase(type)) {
            return true;
        }
        if ("ping".equalsIgnoreCase(rawPayload.trim())) {
            return true;
        }
        return node.has("ping") && node.get("ping").isBoolean() && node.get("ping").asBoolean();
    }

    private boolean isTelemetry(JsonNode node) {
        String type = node.path("type").asString("");
        if ("TELEMETRY".equalsIgnoreCase(type) || "HEARTBEAT".equalsIgnoreCase(type)) {
            return true;
        }
        return node.has("ping")
                || node.has("rssi")
                || node.has("freeHeap")
                || node.has("free_heap")
                || node.has("distance")
                || node.has("fillLevel")
                || node.has("fill_level");
    }

    private ObjectNode buildEnvelope(String type, String message) {
        ObjectNode envelope = objectMapper.createObjectNode();
        envelope.put("type", type);
        envelope.put("payload", message);
        envelope.put("timestamp", Instant.now().toString());
        return envelope;
    }

    private JsonNode tryParse(String payload) {
        try {
            return objectMapper.readTree(payload);
        } catch (RuntimeException e) {
            return null;
        }
    }

    private void broadcastExcept(String excludedSessionId, String jsonPayload) {
        TextMessage textMessage = new TextMessage(jsonPayload);
        sessions.forEach((id, session) -> {
            if (id.equals(excludedSessionId)) {
                return;
            }
            if (session.isOpen()) {
                sendToSession(session, textMessage);
            } else {
                sessions.remove(id, session);
            }
        });
    }

    private void sendToSession(WebSocketSession session, String payload) {
        sendToSession(session, new TextMessage(payload));
    }

    private void sendToSession(WebSocketSession session, TextMessage message) {
        if (session == null || !session.isOpen()) {
            return;
        }
        try {
            session.sendMessage(message);
        } catch (IOException e) {
            log.warn("I/O failure sending to session {}; dropping it", session.getId(), e);
            closeQuietly(session);
            sessions.remove(session.getId(), session);
        } catch (RuntimeException e) {
            log.warn("Unexpected failure sending to session {}; dropping it", session.getId(), e);
            closeQuietly(session);
            sessions.remove(session.getId(), session);
        }
    }

    private void closeQuietly(WebSocketSession session) {
        try {
            if (session.isOpen()) {
                session.close(CloseStatus.SERVER_ERROR);
            }
        } catch (IOException e) {
            log.debug("Error closing WebSocket session {}", session.getId(), e);
        }
    }
}
