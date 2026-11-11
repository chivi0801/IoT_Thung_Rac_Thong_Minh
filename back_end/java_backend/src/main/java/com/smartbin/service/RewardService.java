package com.smartbin.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.smartbin.dto.request.GiftRequest;
import com.smartbin.dto.request.RatesConfigRequest;
import com.smartbin.dto.response.GiftResponse;
import com.smartbin.dto.response.RatesConfigResponse;
import com.smartbin.dto.response.RedemptionResponse;
import com.smartbin.entity.Gift;
import com.smartbin.entity.Redemption;
import com.smartbin.entity.SystemSetting;
import com.smartbin.exception.ResourceNotFoundException;
import com.smartbin.repository.GiftRepository;
import com.smartbin.repository.RedemptionRepository;
import com.smartbin.repository.SystemSettingRepository;

/**
 * Business logic for reward point configuration, gift inventory management
 * and redemption history.
 */
@Service
public class RewardService {

    private static final String KEY_RATE_PLASTIC = "rate_plastic";
    private static final String KEY_RATE_METAL = "rate_metal";
    private static final String KEY_RATE_ORGANIC = "rate_organic";
    private static final String KEY_EVENT_MULTIPLIER = "event_multiplier";

    private static final int DEFAULT_RATE_PLASTIC = 10;
    private static final int DEFAULT_RATE_METAL = 15;
    private static final int DEFAULT_RATE_ORGANIC = 5;
    private static final double DEFAULT_EVENT_MULTIPLIER = 1.0;

    private static final String STATUS_ACTIVE = "active";
    private static final String STATUS_INACTIVE = "inactive";

    private static final String DEFAULT_ICON = "🎁";
    private static final int LOW_STOCK_THRESHOLD = 20;

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final GiftRepository giftRepository;
    private final RedemptionRepository redemptionRepository;
    private final SystemSettingRepository systemSettingRepository;

    public RewardService(GiftRepository giftRepository,
            RedemptionRepository redemptionRepository,
            SystemSettingRepository systemSettingRepository) {
        this.giftRepository = giftRepository;
        this.redemptionRepository = redemptionRepository;
        this.systemSettingRepository = systemSettingRepository;
    }

    @Transactional(readOnly = true)
    public RatesConfigResponse getRatesConfig() {
        int plastic = systemSettingRepository.getIntOrDefault(KEY_RATE_PLASTIC, DEFAULT_RATE_PLASTIC);
        int metal = systemSettingRepository.getIntOrDefault(KEY_RATE_METAL, DEFAULT_RATE_METAL);
        int organic = systemSettingRepository.getIntOrDefault(KEY_RATE_ORGANIC, DEFAULT_RATE_ORGANIC);
        double multiplier = systemSettingRepository.getDoubleOrDefault(
                KEY_EVENT_MULTIPLIER, DEFAULT_EVENT_MULTIPLIER);

        return new RatesConfigResponse(
                plastic,
                metal,
                organic,
                multiplier,
                giftRepository.countByStatus(STATUS_ACTIVE),
                redemptionRepository.count());
    }

    @Transactional
    public RatesConfigResponse updateRatesConfig(RatesConfigRequest request) {
        int plastic = request.plastic() == null ? DEFAULT_RATE_PLASTIC : request.plastic();
        int metal = request.metal() == null ? DEFAULT_RATE_METAL : request.metal();
        int organic = request.organic() == null ? DEFAULT_RATE_ORGANIC : request.organic();
        double multiplier = request.multiplier() == null ? DEFAULT_EVENT_MULTIPLIER : request.multiplier();

        saveSetting(KEY_RATE_PLASTIC, String.valueOf(plastic),
                "Điểm quy đổi cho mỗi vật thể nhựa");
        saveSetting(KEY_RATE_METAL, String.valueOf(metal),
                "Điểm quy đổi cho mỗi vật thể kim loại");
        saveSetting(KEY_RATE_ORGANIC, String.valueOf(organic),
                "Điểm quy đổi cho mỗi vật thể hữu cơ");
        saveSetting(KEY_EVENT_MULTIPLIER, String.valueOf(multiplier),
                "Hệ số nhân điểm trong sự kiện");

        return getRatesConfig();
    }

    @Transactional(readOnly = true)
    public List<GiftResponse> getAllGifts() {
        return giftRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(RewardService::toGiftResponse)
                .toList();
    }

    @Transactional
    public GiftResponse createGift(GiftRequest request) {
        Gift gift = new Gift();
        applyGiftFields(gift, request, STATUS_ACTIVE);
        Gift saved = giftRepository.save(gift);
        return toGiftResponse(saved);
    }

    @Transactional
    public GiftResponse updateGift(Long id, GiftRequest request) {
        Gift gift = giftRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy phần quà có id = " + id));

        applyGiftFields(gift, request, gift.getStatus());
        Gift saved = giftRepository.save(gift);
        return toGiftResponse(saved);
    }

    @Transactional
    public GiftResponse toggleGiftStatus(Long id) {
        Gift gift = giftRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy phần quà có id = " + id));

        String nextStatus = STATUS_ACTIVE.equalsIgnoreCase(gift.getStatus())
                ? STATUS_INACTIVE
                : STATUS_ACTIVE;
        gift.setStatus(nextStatus);

        Gift saved = giftRepository.save(gift);
        return toGiftResponse(saved);
    }

    @Transactional
    public void deleteGift(Long id) {
        if (giftRepository.existsById(id)) {
            giftRepository.deleteById(id);
        }
    }

    @Transactional(readOnly = true)
    public List<RedemptionResponse> getAllRedemptions() {
        return redemptionRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(RewardService::toRedemptionResponse)
                .toList();
    }

    private void applyGiftFields(Gift gift, GiftRequest request, String fallbackStatus) {
        gift.setName(request.name() == null ? null : request.name().trim());
        gift.setIcon(isBlank(request.icon()) ? DEFAULT_ICON : request.icon().trim());
        gift.setPoints(request.points() == null ? 1 : Math.max(1, request.points()));
        gift.setStock(request.stock() == null ? 0 : Math.max(0, request.stock()));
        gift.setDescription(request.desc());
        gift.setStatus(normalizeStatus(request.status(), fallbackStatus));
    }

    private static String normalizeStatus(String requestedStatus, String fallbackStatus) {
        if (!isBlank(requestedStatus)) {
            return STATUS_INACTIVE.equalsIgnoreCase(requestedStatus.trim())
                    ? STATUS_INACTIVE
                    : STATUS_ACTIVE;
        }
        if (!isBlank(fallbackStatus)) {
            return STATUS_INACTIVE.equalsIgnoreCase(fallbackStatus.trim())
                    ? STATUS_INACTIVE
                    : STATUS_ACTIVE;
        }
        return STATUS_ACTIVE;
    }

    private static GiftResponse toGiftResponse(Gift gift) {
        int stock = gift.getStock() == null ? 0 : gift.getStock();
        return new GiftResponse(
                gift.getId(),
                gift.getName(),
                gift.getIcon(),
                gift.getPoints(),
                gift.getStock(),
                gift.getDescription(),
                gift.getStatus(),
                stock < LOW_STOCK_THRESHOLD);
    }

    private static RedemptionResponse toRedemptionResponse(Redemption redemption) {
        return new RedemptionResponse(
                redemption.getId(),
                redemption.getVoucherCode(),
                redemption.getStudentMssv(),
                redemption.getStudentName(),
                redemption.getGiftName(),
                redemption.getPointsSpent(),
                formatRedemptionTime(redemption.getCreatedAt()),
                redemption.getStatus());
    }

    private static String formatRedemptionTime(LocalDateTime createdAt) {
        if (createdAt == null) {
            return "";
        }

        LocalDate today = LocalDate.now();
        LocalDate date = createdAt.toLocalDate();
        if (date.equals(today)) {
            return createdAt.format(TIME_FORMATTER) + " - Hôm nay";
        }
        if (date.equals(today.minusDays(1))) {
            return createdAt.format(TIME_FORMATTER) + " - Hôm qua";
        }
        return createdAt.format(DATE_TIME_FORMATTER);
    }

    private void saveSetting(String key, String value, String description) {
        SystemSetting setting = systemSettingRepository.findById(key)
                .orElseGet(() -> {
                    SystemSetting created = new SystemSetting();
                    created.setSettingKey(key);
                    return created;
                });

        setting.setSettingValue(value);
        if (isBlank(setting.getDescription())) {
            setting.setDescription(description);
        }
        setting.setUpdatedAt(LocalDateTime.now());

        systemSettingRepository.save(setting);
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
