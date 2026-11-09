package com.smartbin.config;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import jakarta.annotation.PostConstruct;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * MVC configuration that exposes locally stored uploads and guarantees the
 * physical {@code uploads/} directory exists at application startup.
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private static final Logger log = LoggerFactory.getLogger(WebMvcConfig.class);
    private static final String UPLOAD_DIRECTORY = "uploads";

    @PostConstruct
    public void initializeUploadDirectory() {
        Path uploadPath = resolveUploadPath();
        try {
            Files.createDirectories(uploadPath);
            log.info("Upload directory is ready at {}", uploadPath);
        } catch (IOException e) {
            throw new IllegalStateException(
                    "Failed to create upload directory at " + uploadPath, e);
        }
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:uploads/")
                .setCachePeriod(3600);

        log.info("Serving static uploads: /uploads/** -> file:uploads/");
    }

    private Path resolveUploadPath() {
        return Paths.get(UPLOAD_DIRECTORY).toAbsolutePath().normalize();
    }
}
