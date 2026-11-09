package com.smartbin.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import com.smartbin.websocket.IoTTelescopeWebSocketHandler;

/**
 * Registers the IoT WebSocket handler for ESP32-S3 devices and browser
 * dashboards.
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final IoTTelescopeWebSocketHandler webSocketHandler;

    public WebSocketConfig(IoTTelescopeWebSocketHandler webSocketHandler) {
        this.webSocketHandler = webSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(webSocketHandler, "/ws/iot", "/ws/iot-telemetry")
                .setAllowedOriginPatterns("*");
    }
}
