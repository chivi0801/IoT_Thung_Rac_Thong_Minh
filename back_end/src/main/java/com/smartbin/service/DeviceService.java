package com.smartbin.service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.smartbin.dto.request.ThresholdConfigRequest;
import com.smartbin.dto.response.CompartmentResponse;
import com.smartbin.dto.response.DeviceConfigResponse;
import com.smartbin.dto.response.HardwareInfoResponse;
import com.smartbin.entity.Compartment;
import com.smartbin.entity.SystemSetting;
import com.smartbin.exception.ResourceNotFoundException;
import com.smartbin.repository.CompartmentRepository;
import com.smartbin.repository.SystemSettingRepository;

/**
 * Business logic for the device & compartment management page.
 *
 * <p>Converts ultrasonic distances into fill percentages, evaluates warning
 * status against a configurable threshold and exposes hardware telemetry.</p>
 */
@Service
public class DeviceService {

    /** Physical depth of every compartment in centimetres. */
    private static final double CAP = 30.0;

    /** Distance measured after a compartment has been emptied (95% of depth). */
    private static final double EMPTY_DISTANCE = CAP * 0.95;

    private static final String KEY_THRESHOLD_FULL = "threshold_full";
    private static final String KEY_THRESHOLD_CONF = "threshold_conf";

    private static final int DEFAULT_THRESHOLD_FULL = 80;
    private static final int DEFAULT_THRESHOLD_CONF = 60;

    private static final int FULL_LEVEL = 95;

    private static final String STATUS_CLASS_OK = "ok";
    private static final String STATUS_CLASS_WARN = "warn";
    private static final String STATUS_CLASS_BAD = "bad";

    private static final String STATUS_TEXT_OK = "BÌNH THƯỜNG";
    private static final String STATUS_TEXT_WARN = "SẮP ĐẦY";
    private static final String STATUS_TEXT_BAD = "ĐẦY";

    private static final String MICROCONTROLLER = "ESP32-S3 WROOM CAM";
    private static final String CAMERA = "OV3660 / OV2640";
    private static final String AI_MODEL = "MobileNetV2 / TinyML";
    private static final String FIRMWARE_VERSION = "v1.0.3";
    private static final String DEVICE_STATUS = "ONLINE";
    private static final int WIFI_RSSI = -54;
    private static final int FREE_HEAP_KB = 124;

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm:ss");

    private final CompartmentRepository compartmentRepository;
    private final SystemSettingRepository systemSettingRepository;

    /** Immutable boot instant, safe to read from concurrent requests. */
    private final Instant bootInstant = Instant.now();

    public DeviceService(CompartmentRepository compartmentRepository,
            SystemSettingRepository systemSettingRepository) {
        this.compartmentRepository = compartmentRepository;
        this.systemSettingRepository = systemSettingRepository;
    }

    /**
     * Returns all compartments ordered by id, with computed level and status.
     */
    @Transactional(readOnly = true)
    public List<CompartmentResponse> getCompartmentStatuses() {
        int thresholdFull = getThresholdFull();
        return compartmentRepository.findAllByOrderByIdAsc().stream()
                .map(compartment -> toResponse(compartment, thresholdFull))
                .toList();
    }

    /**
     * Empties a compartment: distance becomes 28.5 cm and item count resets.
     */
    @Transactional
    public CompartmentResponse resetCompartment(Integer id) {
        Compartment compartment = compartmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy ngăn rác có id = " + id));

        compartment.setCurrentDistance(EMPTY_DISTANCE);
        compartment.setItemCount(0);
        compartment.setUpdatedAt(LocalDateTime.now());

        Compartment saved = compartmentRepository.save(compartment);
        return toResponse(saved, getThresholdFull());
    }

    /**
     * Reads the current warning and confidence thresholds.
     */
    @Transactional(readOnly = true)
    public DeviceConfigResponse getDeviceConfigs() {
        return new DeviceConfigResponse(getThresholdFull(), getThresholdConf());
    }

    /**
     * Persists new threshold values and returns the stored configuration.
     */
    @Transactional
    public DeviceConfigResponse updateDeviceConfigs(ThresholdConfigRequest request) {
        int thresholdFull = request.thFull() == null ? DEFAULT_THRESHOLD_FULL : request.thFull();
        int thresholdConf = request.thConf() == null ? DEFAULT_THRESHOLD_CONF : request.thConf();

        saveSetting(KEY_THRESHOLD_FULL, String.valueOf(thresholdFull),
                "Ngưỡng cảnh báo đầy (%)");
        saveSetting(KEY_THRESHOLD_CONF, String.valueOf(thresholdConf),
                "Độ tin cậy tối thiểu của AI (%)");

        return new DeviceConfigResponse(thresholdFull, thresholdConf);
    }

    /**
     * Returns hardware specifications plus telemetry derived at request time.
     */
    @Transactional(readOnly = true)
    public HardwareInfoResponse getHardwareInfo() {
        Duration uptime = Duration.between(bootInstant, Instant.now());

        return new HardwareInfoResponse(
                MICROCONTROLLER,
                CAMERA,
                AI_MODEL,
                LocalTime.now().format(TIME_FORMATTER) + " (vừa xong)",
                WIFI_RSSI,
                formatUptime(uptime),
                FIRMWARE_VERSION,
                FREE_HEAP_KB,
                DEVICE_STATUS);
    }

    private CompartmentResponse toResponse(Compartment compartment, int thresholdFull) {
        double distance = compartment.getCurrentDistance() == null ? CAP : compartment.getCurrentDistance();
        int level = computeLevel(distance);
        CompartmentStatus status = evaluateStatus(level, thresholdFull);
        int count = compartment.getItemCount() == null ? 0 : compartment.getItemCount();

        return new CompartmentResponse(
                compartment.getId(),
                compartment.getKey(),
                compartment.getName(),
                level,
                count,
                distance,
                status.statusClass(),
                status.statusText());
    }

    private static int computeLevel(double distance) {
        double raw = (CAP - distance) / CAP * 100.0;
        long rounded = Math.round(raw);
        return (int) Math.min(100, Math.max(0, rounded));
    }

    private static CompartmentStatus evaluateStatus(int level, int thresholdFull) {
        if (level >= FULL_LEVEL) {
            return new CompartmentStatus(STATUS_CLASS_BAD, STATUS_TEXT_BAD);
        }
        if (level >= thresholdFull) {
            return new CompartmentStatus(STATUS_CLASS_WARN, STATUS_TEXT_WARN);
        }
        return new CompartmentStatus(STATUS_CLASS_OK, STATUS_TEXT_OK);
    }

    private int getThresholdFull() {
        return systemSettingRepository.getIntOrDefault(KEY_THRESHOLD_FULL, DEFAULT_THRESHOLD_FULL);
    }

    private int getThresholdConf() {
        return systemSettingRepository.getIntOrDefault(KEY_THRESHOLD_CONF, DEFAULT_THRESHOLD_CONF);
    }

    private void saveSetting(String key, String value, String description) {
        SystemSetting setting = systemSettingRepository.findById(key)
                .orElseGet(() -> {
                    SystemSetting created = new SystemSetting();
                    created.setSettingKey(key);
                    return created;
                });

        setting.setSettingValue(value);
        if (setting.getDescription() == null || setting.getDescription().isBlank()) {
            setting.setDescription(description);
        }
        setting.setUpdatedAt(LocalDateTime.now());

        systemSettingRepository.save(setting);
    }

    private static String formatUptime(Duration uptime) {
        long totalMinutes = Math.max(0, uptime.toMinutes());
        long days = totalMinutes / (24 * 60);
        long hours = (totalMinutes % (24 * 60)) / 60;
        long minutes = totalMinutes % 60;

        StringBuilder builder = new StringBuilder();
        if (days > 0) {
            builder.append(days).append(" ngày ");
        }
        if (days > 0 || hours > 0) {
            builder.append(hours).append(" giờ ");
        }
        builder.append(minutes).append(" phút");

        return builder.toString();
    }

    private record CompartmentStatus(String statusClass, String statusText) {
    }
}
