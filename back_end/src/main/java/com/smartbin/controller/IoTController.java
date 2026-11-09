package com.smartbin.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.smartbin.dto.request.TelemetryRequest;
import com.smartbin.dto.response.ApiResponse;
import com.smartbin.dto.response.ClassificationResponse;
import com.smartbin.dto.response.PingResponse;
import com.smartbin.service.ClassificationService;
import com.smartbin.service.IoTService;

import jakarta.validation.Valid;

/**
 * REST endpoints used by the ESP32-S3 firmware for telemetry, classification
 * and heartbeat checks.
 */
@RestController
@RequestMapping("/api/v1/iot")
public class IoTController {

    private final ClassificationService classificationService;
    private final IoTService iotService;

    public IoTController(ClassificationService classificationService, IoTService iotService) {
        this.classificationService = classificationService;
        this.iotService = iotService;
    }

    @PostMapping("/telemetry")
    public ApiResponse<String> processTelemetry(@Valid @RequestBody TelemetryRequest request) {
        iotService.processTelemetry(request);
        return ApiResponse.success("Telemetry processed", "Telemetry processed");
    }

    @PostMapping(value = "/classify-frame", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ClassificationResponse> classifyFrame(
            @RequestParam("file") MultipartFile file,
            @RequestParam(name = "port", defaultValue = "1") Integer port) {
        ClassificationResponse response = classificationService.processIncomingFrame(file, port);
        return ResponseEntity.status(HttpStatus.OK).body(response);
    }

    @GetMapping("/ping")
    public ApiResponse<PingResponse> ping() {
        return ApiResponse.success(iotService.handlePing(), "ESP32 connection active");
    }
}
