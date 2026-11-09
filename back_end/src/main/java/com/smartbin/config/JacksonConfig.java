package com.smartbin.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Provides the Jackson 2 {@link ObjectMapper} used by the WebSocket gateway and
 * broadcast service.
 *
 * <p>Spring Boot 4 auto-configures a Jackson 3 mapper by default, so this bean
 * keeps the legacy {@code com.fasterxml.jackson} API available for the
 * realtime pipeline.</p>
 */
@Configuration
public class JacksonConfig {

    @Bean
    @Primary
    public ObjectMapper jacksonObjectMapper() {
        return new ObjectMapper();
    }
}
