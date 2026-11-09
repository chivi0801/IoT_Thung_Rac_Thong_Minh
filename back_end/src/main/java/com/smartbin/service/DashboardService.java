package com.smartbin.service;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.smartbin.dto.response.DashboardKpiResponse;
import com.smartbin.dto.response.LatestDetectionResponse;
import com.smartbin.dto.response.RecentActivityResponse;
import com.smartbin.entity.WasteLog;
import com.smartbin.repository.WasteLogRepository;

/**
 * Business logic backing the admin overview dashboard.
 *
 * <p>All read methods are null-safe and tolerate an empty database so the
 * frontend always receives a usable payload instead of an exception.</p>
 */
@Service
public class DashboardService {

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm:ss");

    private static final String DEFAULT_STATUS = "ĐÃ PHÂN LOẠI";
    private static final String DEFAULT_MODEL_CLASS = "unknown";

    private static final String CSV_BOM = "\uFEFF";
    private static final String CSV_HEADER = "Thoi_gian,Phan_loai,Do_tin_cay,Trang_thai\n";

    private static final String[] FAILURE_KEYWORDS = {"thất bại", "lỗi"};

    private final WasteLogRepository wasteLogRepository;

    public DashboardService(WasteLogRepository wasteLogRepository) {
        this.wasteLogRepository = wasteLogRepository;
    }

    /**
     * Builds the four KPI cards: total volume, success rate and the per
     * compartment counts with their percentages. Divide-by-zero is handled
     * explicitly so an empty table yields zero values.
     */
    @Transactional(readOnly = true)
    public DashboardKpiResponse getKpiOverview() {
        long totalCount = wasteLogRepository.count();
        long plasticCount = wasteLogRepository.countByCatKey("pl");
        long metalCount = wasteLogRepository.countByCatKey("me");
        long organicCount = wasteLogRepository.countByCatKey("or");

        return new DashboardKpiResponse(
                totalCount,
                buildSuccessRate(totalCount),
                plasticCount,
                percentage(plasticCount, totalCount),
                metalCount,
                percentage(metalCount, totalCount),
                organicCount,
                percentage(organicCount, totalCount));
    }

    /**
     * Returns the newest detection. When no log exists a preview-compatible
     * fallback is returned so the camera card is never empty.
     */
    @Transactional(readOnly = true)
    public LatestDetectionResponse getLatestDetection() {
        return wasteLogRepository.findTopByOrderByCreatedAtDesc()
                .map(this::toLatestDetection)
                .orElseGet(DashboardService::defaultLatestDetection);
    }

    /**
     * Returns up to four newest activities for the overview table.
     */
    @Transactional(readOnly = true)
    public List<RecentActivityResponse> getRecentActivities() {
        List<WasteLog> logs = wasteLogRepository.findTop4ByOrderByCreatedAtDesc();
        List<RecentActivityResponse> activities = new ArrayList<>(logs.size());

        for (WasteLog log : logs) {
            String catKey = resolveCatKey(log.getCatKey());
            activities.add(new RecentActivityResponse(
                    formatTime(log.getCreatedAt()),
                    resolveCategory(log.getCategory(), catKey),
                    catKey,
                    formatConfidence(log.getConfidence()),
                    resolveStatus(log.getServoStatus()),
                    resolveModelClass(log.getModelClass()),
                    resolveIconType(log.getIconType(), catKey)));
        }

        return List.copyOf(activities);
    }

    /**
     * Serializes the complete classification history as an Excel-friendly
     * UTF-8 CSV including the byte order mark.
     */
    @Transactional(readOnly = true)
    public byte[] exportCsvLog() {
        List<WasteLog> logs = wasteLogRepository.findAllByOrderByCreatedAtDesc();
        StringBuilder csv = new StringBuilder(CSV_BOM).append(CSV_HEADER);

        for (WasteLog log : logs) {
            csv.append(csvCell(formatTime(log.getCreatedAt())))
                    .append(',')
                    .append(csvCell(log.getCategory()))
                    .append(',')
                    .append(csvCell(formatConfidence(log.getConfidence())))
                    .append(',')
                    .append(csvCell(resolveStatus(log.getServoStatus())))
                    .append('\n');
        }

        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    private LatestDetectionResponse toLatestDetection(WasteLog log) {
        String catKey = resolveCatKey(log.getCatKey());
        return new LatestDetectionResponse(
                log.getId(),
                formatTime(log.getCreatedAt()),
                resolveCategory(log.getCategory(), catKey),
                catKey,
                resolveModelClass(log.getModelClass()),
                formatConfidence(log.getConfidence()),
                log.getConfidence(),
                resolveIconType(log.getIconType(), catKey),
                resolveStatus(log.getServoStatus()));
    }

    private String buildSuccessRate(long totalCount) {
        if (totalCount <= 0) {
            return "0%";
        }

        long failedCount = 0;
        for (String keyword : FAILURE_KEYWORDS) {
            failedCount += wasteLogRepository.countByServoStatusContainingIgnoreCase(keyword);
        }

        long successfulCount = Math.max(0, totalCount - failedCount);
        long rate = Math.round(successfulCount * 100.0 / totalCount);
        return rate + "%";
    }

    private static double percentage(long part, long total) {
        if (total <= 0) {
            return 0.0;
        }
        return Math.round(part * 1000.0 / total) / 10.0;
    }

    private static String formatTime(LocalDateTime createdAt) {
        return createdAt == null ? "" : createdAt.format(TIME_FORMATTER);
    }

    private static String formatConfidence(Double confidence) {
        return confidence == null ? "" : String.format(Locale.US, "%.1f%%", confidence);
    }

    private static String resolveCatKey(String rawCatKey) {
        if (rawCatKey == null || rawCatKey.isBlank()) {
            return "pl";
        }
        return switch (rawCatKey.trim().toLowerCase(Locale.ROOT)) {
            case "me", "kim-loai", "kim loại", "metal" -> "me";
            case "or", "huu-co", "hữu cơ", "organic" -> "or";
            default -> "pl";
        };
    }

    private static String resolveCategory(String category, String catKey) {
        if (category != null && !category.isBlank()) {
            return category;
        }
        return switch (catKey) {
            case "me" -> "KIM LOẠI";
            case "or" -> "HỮU CƠ";
            default -> "NHỰA";
        };
    }

    private static String resolveIconType(String iconType, String catKey) {
        if (iconType != null && !iconType.isBlank()) {
            return iconType;
        }
        return switch (catKey) {
            case "me" -> "can";
            case "or" -> "organic";
            default -> "bottle";
        };
    }

    private static String resolveModelClass(String modelClass) {
        return modelClass == null || modelClass.isBlank() ? DEFAULT_MODEL_CLASS : modelClass;
    }

    private static String resolveStatus(String status) {
        return status == null || status.isBlank() ? DEFAULT_STATUS : status;
    }

    private static String csvCell(String value) {
        String safeValue = value == null ? "" : value;
        return "\"" + safeValue.replace("\"", "\"\"") + "\"";
    }

    private static LatestDetectionResponse defaultLatestDetection() {
        return new LatestDetectionResponse(
                0L,
                "10:24:15",
                "NHỰA",
                "pl",
                "plastic_bottle",
                "96.4%",
                96.4,
                "bottle",
                DEFAULT_STATUS);
    }
}
