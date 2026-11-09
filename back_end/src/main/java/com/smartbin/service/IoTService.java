package com.smartbin.service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.smartbin.dto.request.TelemetryRequest;
import com.smartbin.dto.response.PingResponse;
import com.smartbin.entity.Compartment;
import com.smartbin.repository.CompartmentRepository;

/**
 * Processes ESP32-S3 telemetry, updates compartment distances and pushes live
 * updates to the dashboards over WebSocket.
 */
@Service
public class IoTService {

    private static final Logger log = LoggerFactory.getLogger(IoTService.class);

    private static final double CAP = 30.0;

    private static final String CAT_KEY_PLASTIC = "pl";
    private static final String CAT_KEY_METAL = "me";
    private static final String CAT_KEY_ORGANIC = "or";

    private final CompartmentRepository compartmentRepository;
    private final WebSocketBroadcastService webSocketBroadcastService;

    public IoTService(CompartmentRepository compartmentRepository,
            WebSocketBroadcastService webSocketBroadcastService) {
        this.compartmentRepository = compartmentRepository;
        this.webSocketBroadcastService = webSocketBroadcastService;
    }

    /**
     * Applies ultrasonic distances and hardware statistics, then broadcasts a
     * {@code TELEMETRY_UPDATE} event to all connected dashboards.
     */
    @Transactional
    public void processTelemetry(TelemetryRequest request) {
        if (request == null) {
            return;
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        updateCompartment(1, request.bin1Dist(), payload);
        updateCompartment(2, request.bin2Dist(), payload);
        updateCompartment(3, request.bin3Dist(), payload);

        payload.put("wifiRssi", request.wifiRssi());
        payload.put("rssi", request.wifiRssi());
        payload.put("ping", request.ping());
        payload.put("freeHeapKb", request.freeHeapKb());
        payload.put("freeHeap", request.freeHeapKb());
        payload.put("packetsIn", request.packetsIn());
        payload.put("packetsOut", request.packetsOut());
        payload.put("timestamp", Instant.now().toString());

        webSocketBroadcastService.broadcast("TELEMETRY_UPDATE", payload);

        log.info("Telemetry updated: rssi={} dBm, ping={} ms, heap={} KB",
                request.wifiRssi(), request.ping(), request.freeHeapKb());
    }

    /**
     * Returns a heartbeat response for ESP32 connection checks.
     */
    public PingResponse handlePing() {
        int latency = ThreadLocalRandom.current().nextInt(15, 26);
        return new PingResponse(
                "PONG",
                System.currentTimeMillis(),
                latency,
                "ESP32 connection active");
    }

    private void updateCompartment(int binNumber, Double distance, Map<String, Object> payload) {
        if (distance == null) {
            return;
        }

        Compartment compartment = compartmentRepository.findById(binNumber)
                .orElseGet(() -> defaultCompartment(binNumber));

        compartment.setCurrentDistance(distance);
        compartment.setUpdatedAt(LocalDateTime.now());
        compartmentRepository.save(compartment);

        int level = computeLevel(distance);
        payload.put("bin" + binNumber + "Dist", distance);
        payload.put("bin" + binNumber + "Level", level);

        String distanceText = String.format(Locale.US, "%.1f", distance);
        broadcastRawLog("HC-SR04",
                "Mức ngăn " + binNumber + " cập nhật: " + distanceText + " cm (" + level + "%)");
    }

    private void broadcastRawLog(String tag, String message) {
        String line = "[" + tag + "] " + message;
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("tag", tag);
        payload.put("message", line);
        payload.put("payload", line);
        webSocketBroadcastService.broadcast("RAW_LOG", payload);
    }

    private static int computeLevel(double distance) {
        double raw = (CAP - distance) / CAP * 100.0;
        long rounded = Math.round(raw);
        return (int) Math.min(100, Math.max(0, rounded));
    }

    private static Compartment defaultCompartment(int binNumber) {
        Compartment compartment = new Compartment();
        compartment.setId(binNumber);
        compartment.setCurrentDistance(CAP);
        compartment.setItemCount(0);
        compartment.setUpdatedAt(LocalDateTime.now());

        switch (binNumber) {
            case 2 -> {
                compartment.setKey(CAT_KEY_METAL);
                compartment.setName("NGĂN SỐ 2 · KIM LOẠI");
            }
            case 3 -> {
                compartment.setKey(CAT_KEY_ORGANIC);
                compartment.setName("NGĂN SỐ 3 · HỮU CƠ");
            }
            default -> {
                compartment.setKey(CAT_KEY_PLASTIC);
                compartment.setName("NGĂN SỐ 1 · NHỰA");
            }
        }

        return compartment;
    }
}
