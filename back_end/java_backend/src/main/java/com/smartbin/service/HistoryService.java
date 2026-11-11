package com.smartbin.service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.smartbin.dto.response.HistoryItemResponse;
import com.smartbin.dto.response.HistoryPageResponse;
import com.smartbin.dto.response.HistorySnapshotResponse;
import com.smartbin.entity.WasteLog;
import com.smartbin.exception.ResourceNotFoundException;
import com.smartbin.repository.WasteLogRepository;

/**
 * Business logic backing the classification history page and the AI snapshot
 * inspection modal.
 */
@Service
public class HistoryService {

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm:ss");
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private static final String CATEGORY_ALL = "ALL";
    private static final String CATEGORY_PLASTIC = "NHỰA";
    private static final String CATEGORY_METAL = "KIM LOẠI";
    private static final String CATEGORY_ORGANIC = "HỮU CƠ";

    private static final String CAT_KEY_PLASTIC = "nhua";
    private static final String CAT_KEY_METAL = "kim-loai";
    private static final String CAT_KEY_ORGANIC = "huu-co";

    private static final String DEFAULT_PORT = "Cửa nạp #1";
    private static final String DEFAULT_MODEL_CLASS = "unknown";
    private static final String DEFAULT_STATUS = "ĐÃ PHÂN LOẠI";
    private static final String FALLBACK_IMAGE_URL = "/assets/images/ai-snapshot.jpg";

    private static final String[] KNOWN_ICONS = {"bottle", "can", "box", "cup", "organic"};

    private final WasteLogRepository wasteLogRepository;

    public HistoryService(WasteLogRepository wasteLogRepository) {
        this.wasteLogRepository = wasteLogRepository;
    }

    /**
     * Returns a page of history entries. The incoming page number is 1-based
     * and is safely converted to Spring's 0-based pagination.
     */
    @Transactional(readOnly = true)
    public HistoryPageResponse getHistory(int page, int size, String category) {
        int safePage = Math.max(1, page);
        int safeSize = size <= 0 ? 6 : Math.min(size, 100);

        Pageable pageable = PageRequest.of(
                Math.max(0, safePage - 1),
                safeSize,
                Sort.by("createdAt").descending());

        Page<WasteLog> result;
        if (isAllCategory(category)) {
            result = wasteLogRepository.findAllByOrderByCreatedAtDesc(pageable);
        } else {
            result = wasteLogRepository.findByCategoryIgnoreCaseOrderByCreatedAtDesc(category.trim(), pageable);
        }

        List<HistoryItemResponse> items = result.getContent().stream()
                .map(this::toItem)
                .toList();

        return new HistoryPageResponse(
                items,
                result.getTotalElements(),
                result.getTotalPages(),
                safePage,
                safeSize,
                result.hasNext(),
                result.hasPrevious(),
                buildCategoryCounts());
    }

    /**
     * Returns the detailed snapshot data for one history record.
     */
    @Transactional(readOnly = true)
    public HistorySnapshotResponse getSnapshotDetails(Long id) {
        WasteLog log = wasteLogRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy bản ghi lịch sử có id = " + id));

        String catKey = resolveCatKey(log.getCategory(), log.getCatKey());
        String baseCategory = resolveCategory(log.getCategory(), catKey);
        String modelClass = resolveModelClass(log.getModelClass());
        String conf = formatConfidence(log.getConfidence());
        int binNumber = resolveBinNumber(log.getBinNumber(), catKey);

        return new HistorySnapshotResponse(
                log.getId(),
                formatTime(log.getCreatedAt()),
                baseCategory + " (Ngăn " + binNumber + ")",
                catKey,
                modelClass,
                conf,
                buildConfidenceLevel(log.getConfidence(), conf),
                resolveStatus(log.getServoStatus()),
                FALLBACK_IMAGE_URL,
                buildBoundingBox(modelClass));
    }

    private HistoryItemResponse toItem(WasteLog log) {
        String catKey = resolveCatKey(log.getCategory(), log.getCatKey());
        String category = resolveCategory(log.getCategory(), catKey);

        return new HistoryItemResponse(
                log.getId(),
                formatTime(log.getCreatedAt()),
                formatDate(log.getCreatedAt()),
                category,
                catKey,
                resolvePort(log.getPort(), log.getBinNumber()),
                resolveModelClass(log.getModelClass()),
                formatConfidence(log.getConfidence()),
                log.getConfidence() == null ? 0.0 : log.getConfidence(),
                resolveIcon(log.getIconType(), log.getModelClass(), catKey),
                resolveStatus(log.getServoStatus()));
    }

    private Map<String, Long> buildCategoryCounts() {
        Map<String, Long> counts = new LinkedHashMap<>();
        counts.put(CATEGORY_ALL, wasteLogRepository.count());
        counts.put(CATEGORY_PLASTIC, wasteLogRepository.countByCategoryIgnoreCase(CATEGORY_PLASTIC));
        counts.put(CATEGORY_METAL, wasteLogRepository.countByCategoryIgnoreCase(CATEGORY_METAL));
        counts.put(CATEGORY_ORGANIC, wasteLogRepository.countByCategoryIgnoreCase(CATEGORY_ORGANIC));
        return counts;
    }

    private static boolean isAllCategory(String category) {
        return category == null
                || category.isBlank()
                || CATEGORY_ALL.equalsIgnoreCase(category.trim());
    }

    private static String resolveCatKey(String category, String rawCatKey) {
        String normalizedCategory = category == null ? "" : category.trim().toUpperCase(Locale.ROOT);

        if (normalizedCategory.contains("KIM")) {
            return CAT_KEY_METAL;
        }
        if (normalizedCategory.contains("HỮU") || normalizedCategory.contains("HUU")
                || normalizedCategory.contains("GIẤY") || normalizedCategory.contains("GIAY")
                || normalizedCategory.contains("PAPER")) {
            return CAT_KEY_ORGANIC;
        }
        if (normalizedCategory.contains("NHỰA") || normalizedCategory.contains("NHUA")) {
            return CAT_KEY_PLASTIC;
        }

        if (rawCatKey != null) {
            return switch (rawCatKey.trim().toLowerCase(Locale.ROOT)) {
                case "me", "metal", "kim-loai", "kim loại" -> CAT_KEY_METAL;
                case "or", "organic", "huu-co", "hữu cơ" -> CAT_KEY_ORGANIC;
                default -> CAT_KEY_PLASTIC;
            };
        }

        return CAT_KEY_PLASTIC;
    }

    private static String resolveCategory(String category, String catKey) {
        if (category != null && !category.isBlank()) {
            return category;
        }
        return switch (catKey) {
            case CAT_KEY_METAL -> CATEGORY_METAL;
            case CAT_KEY_ORGANIC -> CATEGORY_ORGANIC;
            default -> CATEGORY_PLASTIC;
        };
    }

    private static String resolvePort(String port, Integer binNumber) {
        if (port != null && !port.isBlank()) {
            return port;
        }
        int bin = binNumber == null || binNumber <= 0 ? 1 : binNumber;
        return "Cửa nạp #" + bin;
    }

    private static String resolveModelClass(String modelClass) {
        return modelClass == null || modelClass.isBlank() ? DEFAULT_MODEL_CLASS : modelClass;
    }

    private static String resolveStatus(String status) {
        return status == null || status.isBlank() ? DEFAULT_STATUS : status;
    }

    private static String resolveIcon(String iconType, String modelClass, String catKey) {
        if (iconType != null) {
            String normalizedIcon = iconType.trim().toLowerCase(Locale.ROOT);
            for (String known : KNOWN_ICONS) {
                if (known.equals(normalizedIcon)) {
                    return known;
                }
            }
        }

        String normalizedClass = modelClass == null ? "" : modelClass.toLowerCase(Locale.ROOT);
        if (normalizedClass.contains("cup")) {
            return "cup";
        }
        if (normalizedClass.contains("box") || normalizedClass.contains("carton")
                || normalizedClass.contains("milk")) {
            return "box";
        }
        if (normalizedClass.contains("can") || normalizedClass.contains("metal")
                || normalizedClass.contains("tin")) {
            return "can";
        }
        if (normalizedClass.contains("organic") || normalizedClass.contains("peel")
                || normalizedClass.contains("apple") || normalizedClass.contains("food")) {
            return "organic";
        }

        return switch (catKey) {
            case CAT_KEY_METAL -> "can";
            case CAT_KEY_ORGANIC -> "organic";
            default -> "bottle";
        };
    }

    private static int resolveBinNumber(Integer binNumber, String catKey) {
        if (binNumber != null && binNumber > 0) {
            return binNumber;
        }
        return switch (catKey) {
            case CAT_KEY_METAL -> 2;
            case CAT_KEY_ORGANIC -> 3;
            default -> 1;
        };
    }

    private static String formatTime(LocalDateTime createdAt) {
        return createdAt == null ? "" : createdAt.format(TIME_FORMATTER);
    }

    private static String formatDate(LocalDateTime createdAt) {
        return createdAt == null ? "" : createdAt.format(DATE_FORMATTER);
    }

    private static String formatConfidence(Double confidence) {
        return confidence == null ? "0.0%" : String.format(Locale.US, "%.1f%%", confidence);
    }

    private static String buildConfidenceLevel(Double confidence, String conf) {
        if (confidence == null) {
            return conf + " (THẤP)";
        }
        if (confidence >= 90.0) {
            return conf + " (CAO)";
        }
        if (confidence >= 70.0) {
            return conf + " (TRUNG BÌNH)";
        }
        return conf + " (THẤP)";
    }

    private static Map<String, Object> buildBoundingBox(String modelClass) {
        Map<String, Object> boundingBox = new LinkedHashMap<>();
        boundingBox.put("x", 0.18);
        boundingBox.put("y", 0.22);
        boundingBox.put("width", 0.54);
        boundingBox.put("height", 0.42);
        boundingBox.put("label", modelClass);
        return boundingBox;
    }
}
