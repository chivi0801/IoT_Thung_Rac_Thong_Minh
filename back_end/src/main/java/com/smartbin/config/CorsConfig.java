package com.smartbin.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Global CORS configuration for the Smart Waste Bin REST API.
 *
 * <p>Wildcard local origin patterns are registered through
 * {@link CorsRegistry#allowedOriginPatterns(String...)} so that
 * {@code allowCredentials(true)} remains valid (a literal {@code "*"}
 * origin is not allowed together with credentials).</p>
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    private static final String[] ALLOWED_ORIGIN_PATTERNS = {
            "http://localhost:5500",
            "http://127.0.0.1:5500",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:8080",
            "http://127.0.0.1:8080",
            "http://localhost:*",
            "http://127.0.0.1:*"
    };

    private static final String[] ALLOWED_METHODS = {
            "GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"
    };

    private static final String[] EXPOSED_HEADERS = {
            "Authorization",
            "Content-Type",
            "Content-Disposition",
            "X-Requested-With"
    };

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns(ALLOWED_ORIGIN_PATTERNS)
                .allowedMethods(ALLOWED_METHODS)
                .allowedHeaders("*")
                .exposedHeaders(EXPOSED_HEADERS)
                .allowCredentials(true)
                .maxAge(3600);
    }
}
