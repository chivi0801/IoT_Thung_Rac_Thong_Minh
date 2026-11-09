package com.smartbin.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ThreadLocalRandom;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.smartbin.dto.request.ClaimRewardRequest;
import com.smartbin.dto.request.RedeemGiftRequest;
import com.smartbin.dto.response.StudentHistoryResponse;
import com.smartbin.dto.response.StudentProfileResponse;
import com.smartbin.dto.response.VoucherResponse;
import com.smartbin.entity.Gift;
import com.smartbin.entity.Redemption;
import com.smartbin.entity.Student;
import com.smartbin.entity.WasteLog;
import com.smartbin.exception.BusinessException;
import com.smartbin.exception.ResourceNotFoundException;
import com.smartbin.repository.GiftRepository;
import com.smartbin.repository.RedemptionRepository;
import com.smartbin.repository.StudentRepository;
import com.smartbin.repository.SystemSettingRepository;
import com.smartbin.repository.WasteLogRepository;
import com.smartbin.service.OcrService.OcrResult;

/**
 * Business logic for the student portal: card scanning, point claiming,
 * personal history and gift redemption.
 */
@Service
public class StudentService {

    private static final String CATEGORY_PLASTIC = "NHỰA";
    private static final String CATEGORY_METAL = "KIM LOẠI";
    private static final String CATEGORY_ORGANIC = "HỮU CƠ";

    private static final String KEY_RATE_PLASTIC = "rate_plastic";
    private static final String KEY_RATE_METAL = "rate_metal";
    private static final String KEY_RATE_ORGANIC = "rate_organic";
    private static final String KEY_EVENT_MULTIPLIER = "event_multiplier";

    private static final int DEFAULT_RATE_PLASTIC = 10;
    private static final int DEFAULT_RATE_METAL = 15;
    private static final int DEFAULT_RATE_ORGANIC = 5;
    private static final double DEFAULT_EVENT_MULTIPLIER = 1.0;

    private static final String STATUS_ACTIVE = "active";
    private static final String STATUS_PENDING = "pending";
    private static final String DEFAULT_HISTORY_STATUS = "Đã gạt vào ngăn";
    private static final String SERVO_SUCCESS = "Thành công";

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter SHORT_DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM HH:mm");

    private final StudentRepository studentRepository;
    private final WasteLogRepository wasteLogRepository;
    private final GiftRepository giftRepository;
    private final RedemptionRepository redemptionRepository;
    private final SystemSettingRepository systemSettingRepository;
    private final OcrService ocrService;

    public StudentService(StudentRepository studentRepository,
            WasteLogRepository wasteLogRepository,
            GiftRepository giftRepository,
            RedemptionRepository redemptionRepository,
            SystemSettingRepository systemSettingRepository,
            OcrService ocrService) {
        this.studentRepository = studentRepository;
        this.wasteLogRepository = wasteLogRepository;
        this.giftRepository = giftRepository;
        this.redemptionRepository = redemptionRepository;
        this.systemSettingRepository = systemSettingRepository;
        this.ocrService = ocrService;
    }

    /**
     * Scans a student card, creating the student profile on first sight.
     */
    @Transactional
    public StudentProfileResponse scanStudentCard(MultipartFile file) {
        OcrResult ocr = ocrService.extractStudentInfo(file);

        Student student = studentRepository.findByMssv(ocr.mssv())
                .orElseGet(() -> new Student());

        if (student.getMssv() == null) {
            student.setMssv(ocr.mssv());
        }
        if (isBlank(student.getFullName())) {
            student.setFullName(ocr.name());
        }
        if (isBlank(student.getFaculty())) {
            student.setFaculty(ocr.dept());
        }
        if (isBlank(student.getClassName())) {
            student.setClassName(ocr.className());
        }
        if (student.getTotalPoints() == null) {
            student.setTotalPoints(0);
        }
        if (isBlank(student.getRankTitle())) {
            student.setRankTitle(resolveRank(student.getTotalPoints()).rankTitle());
        }
        student.setAvatarUrl(ocr.avatarUrl());

        Student saved = studentRepository.save(student);
        return toProfileResponse(saved);
    }

    /**
     * Returns the profile of an existing student.
     */
    @Transactional(readOnly = true)
    public StudentProfileResponse getStudentProfile(String mssv) {
        Student student = studentRepository.findByMssv(mssv)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy sinh viên có MSSV = " + mssv));
        return toProfileResponse(student);
    }

    /**
     * Awards green points for a deposited item, links/create the waste log and
     * updates the student's rank.
     */
    @Transactional
    public StudentProfileResponse claimReward(ClaimRewardRequest request) {
        String mssv = request.mssv().trim();
        Student student = studentRepository.findWithLockByMssv(mssv)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy sinh viên có MSSV = " + mssv));

        String category = normalizeCategory(request.wasteCategory());
        int awardedPoints = calculateAwardedPoints(category);

        WasteLog wasteLog = resolveWasteLog(request.wasteLogId(), category);
        wasteLog.setStudentMssv(student.getMssv());
        wasteLog.setPointsAwarded(awardedPoints);
        wasteLogRepository.save(wasteLog);

        int currentPoints = student.getTotalPoints() == null ? 0 : student.getTotalPoints();
        int updatedPoints = currentPoints + awardedPoints;
        student.setTotalPoints(updatedPoints);
        student.setRankTitle(resolveRank(updatedPoints).rankTitle());
        studentRepository.save(student);

        return toProfileResponse(student);
    }

    /**
     * Redeems a gift atomically: deducts points, decrements stock and creates a
     * pending voucher redemption.
     */
    @Transactional
    public VoucherResponse redeemGift(RedeemGiftRequest request) {
        String mssv = request.mssv().trim();
        Student student = studentRepository.findWithLockByMssv(mssv)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy sinh viên có MSSV = " + mssv));

        Gift gift = giftRepository.findWithLockById(request.giftId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy phần quà có id = " + request.giftId()));

        if (!STATUS_ACTIVE.equalsIgnoreCase(gift.getStatus())) {
            throw new BusinessException("Phần quà này hiện đang tạm dừng đổi thưởng.");
        }

        int stock = gift.getStock() == null ? 0 : gift.getStock();
        if (stock <= 0) {
            throw new BusinessException("Phần quà này hiện đã hết trong kho!");
        }

        int points = student.getTotalPoints() == null ? 0 : student.getTotalPoints();
        int giftPoints = gift.getPoints() == null ? 0 : gift.getPoints();
        if (points < giftPoints) {
            throw new BusinessException("Bạn cần thêm " + (giftPoints - points)
                    + " điểm để đổi phần quà này!");
        }

        int remainingPoints = points - giftPoints;
        student.setTotalPoints(remainingPoints);
        student.setRankTitle(resolveRank(remainingPoints).rankTitle());
        studentRepository.save(student);

        gift.setStock(stock - 1);
        giftRepository.save(gift);

        String voucherCode = generateUniqueVoucherCode();

        Redemption redemption = new Redemption();
        redemption.setVoucherCode(voucherCode);
        redemption.setStudentMssv(student.getMssv());
        redemption.setStudentName(student.getFullName());
        redemption.setGiftId(gift.getId());
        redemption.setGiftName(gift.getName());
        redemption.setPointsSpent(giftPoints);
        redemption.setStatus(STATUS_PENDING);
        redemption.setClaimedAt(null);
        redemptionRepository.save(redemption);

        String time = LocalDateTime.now().format(TIME_FORMATTER) + " - Hôm nay";
        String message = "Đổi quà thành công! Hãy xuất trình mã voucher "
                + voucherCode + " tại quầy để nhận quà.";

        return new VoucherResponse(
                voucherCode,
                gift.getName(),
                student.getFullName(),
                student.getMssv(),
                giftPoints,
                time,
                message);
    }

    /**
     * Returns the student's personal recycling history, newest first.
     */
    @Transactional(readOnly = true)
    public List<StudentHistoryResponse> getStudentHistory(String mssv) {
        return wasteLogRepository.findByStudentMssvOrderByCreatedAtDesc(mssv).stream()
                .map(StudentService::toHistoryResponse)
                .toList();
    }

    /**
     * Maps a student entity to its API profile with computed rank progress.
     */
    public StudentProfileResponse toProfileResponse(Student student) {
        int points = student.getTotalPoints() == null ? 0 : student.getTotalPoints();
        RankInfo rank = resolveRank(points);

        return new StudentProfileResponse(
                student.getMssv(),
                student.getFullName(),
                student.getFaculty(),
                student.getClassName(),
                points,
                rank.rankTitle(),
                rank.nextRankPoints(),
                rank.nextRankName(),
                rank.progressPct(),
                student.getAvatarUrl());
    }

    private WasteLog resolveWasteLog(Long wasteLogId, String category) {
        if (wasteLogId != null) {
            WasteLog wasteLog = wasteLogRepository.findById(wasteLogId)
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Không tìm thấy bản ghi rác có id = " + wasteLogId));

            if (isBlank(wasteLog.getCategory())) {
                wasteLog.setCategory(category);
            }
            if (isBlank(wasteLog.getCatKey())) {
                wasteLog.setCatKey(catKeyFor(category));
            }
            return wasteLog;
        }

        WasteLog wasteLog = new WasteLog();
        wasteLog.setItemName(defaultItemName(category));
        wasteLog.setCategory(category);
        wasteLog.setCatKey(catKeyFor(category));
        wasteLog.setConfidence(100.0);
        wasteLog.setModelClass(defaultModelClass(category));
        wasteLog.setIconType(defaultIcon(category));
        wasteLog.setBinNumber(binNumberFor(category));
        wasteLog.setPort(portFor(category));
        wasteLog.setServoStatus(SERVO_SUCCESS);
        return wasteLog;
    }

    private int calculateAwardedPoints(String category) {
        int baseRate = switch (category) {
            case CATEGORY_METAL -> systemSettingRepository.getIntOrDefault(
                    KEY_RATE_METAL, DEFAULT_RATE_METAL);
            case CATEGORY_ORGANIC -> systemSettingRepository.getIntOrDefault(
                    KEY_RATE_ORGANIC, DEFAULT_RATE_ORGANIC);
            default -> systemSettingRepository.getIntOrDefault(
                    KEY_RATE_PLASTIC, DEFAULT_RATE_PLASTIC);
        };

        double multiplier = systemSettingRepository.getDoubleOrDefault(
                KEY_EVENT_MULTIPLIER, DEFAULT_EVENT_MULTIPLIER);

        return (int) Math.max(0, Math.round(baseRate * multiplier));
    }

    private String generateUniqueVoucherCode() {
        for (int attempt = 0; attempt < 50; attempt++) {
            int randomNumber = ThreadLocalRandom.current().nextInt(1000, 10000);
            String code = "ECO-" + randomNumber;
            if (redemptionRepository.findByVoucherCode(code).isEmpty()) {
                return code;
            }
        }
        throw new BusinessException("Không thể tạo mã voucher duy nhất, vui lòng thử lại.");
    }

    private static StudentHistoryResponse toHistoryResponse(WasteLog log) {
        String type = typeFor(log.getCategory(), log.getCatKey());
        String title = isBlank(log.getItemName())
                ? defaultItemName(displayCategoryFor(type))
                : log.getItemName();
        int binNumber = log.getBinNumber() == null || log.getBinNumber() <= 0
                ? binNumberFor(displayCategoryFor(type))
                : log.getBinNumber();
        int points = log.getPointsAwarded() == null
                ? defaultBaseRate(type)
                : log.getPointsAwarded();
        String status = isBlank(log.getServoStatus())
                ? DEFAULT_HISTORY_STATUS
                : log.getServoStatus();

        return new StudentHistoryResponse(
                type,
                title,
                formatHistoryMeta(log.getCreatedAt()) + " • Ngăn nạp #" + binNumber,
                points,
                status);
    }

    private static String formatHistoryMeta(LocalDateTime createdAt) {
        if (createdAt == null) {
            return "";
        }

        LocalDate today = LocalDate.now();
        LocalDate date = createdAt.toLocalDate();
        if (date.equals(today)) {
            return "Hôm nay " + createdAt.format(TIME_FORMATTER);
        }
        if (date.equals(today.minusDays(1))) {
            return "Hôm qua " + createdAt.format(TIME_FORMATTER);
        }
        return createdAt.format(SHORT_DATE_FORMATTER);
    }

    private static RankInfo resolveRank(int points) {
        if (points < 60) {
            return new RankInfo("Tân Binh Xanh (Cấp 1)", 60,
                    "Hạt Giống Xanh (Cấp 2)", progress(points, 60));
        }
        if (points < 120) {
            return new RankInfo("Hạt Giống Xanh (Cấp 2)", 120,
                    "Chiến Binh Xanh (Cấp 3)", progress(points, 120));
        }
        if (points < 200) {
            return new RankInfo("Chiến Binh Xanh (Cấp 3)", 200,
                    "Đại Sứ Môi Trường (Cấp 4)", progress(points, 200));
        }
        if (points < 300) {
            return new RankInfo("Đại Sứ Môi Trường (Cấp 4)", 300,
                    "Thủ Lĩnh Xanh Toàn Trường (Cấp 5)", progress(points, 300));
        }
        return new RankInfo("Thủ Lĩnh Xanh Toàn Trường (Cấp 5)", 300,
                "Thủ Lĩnh Xanh Toàn Trường (Cấp 5)", 100);
    }

    private static int progress(int points, int target) {
        if (target <= 0) {
            return 100;
        }
        long percentage = Math.round(points * 100.0 / target);
        return (int) Math.min(100, Math.max(0, percentage));
    }

    private static String normalizeCategory(String rawCategory) {
        if (isBlank(rawCategory)) {
            return CATEGORY_PLASTIC;
        }
        String normalized = rawCategory.trim().toUpperCase(Locale.ROOT);
        if (normalized.contains("KIM") || normalized.contains("METAL")) {
            return CATEGORY_METAL;
        }
        if (normalized.contains("HỮU") || normalized.contains("HUU")
                || normalized.contains("ORGANIC")) {
            return CATEGORY_ORGANIC;
        }
        return CATEGORY_PLASTIC;
    }

    private static String typeFor(String category, String catKey) {
        String normalized = category == null ? "" : category.trim().toUpperCase(Locale.ROOT);
        if (normalized.contains("KIM")) {
            return "metal";
        }
        if (normalized.contains("HỮU") || normalized.contains("HUU")) {
            return "organic";
        }
        if (!normalized.isBlank()) {
            return "plastic";
        }
        if (catKey != null) {
            return switch (catKey.trim().toLowerCase(Locale.ROOT)) {
                case "me", "metal" -> "metal";
                case "or", "organic" -> "organic";
                default -> "plastic";
            };
        }
        return "plastic";
    }

    private static String displayCategoryFor(String type) {
        return switch (type) {
            case "metal" -> CATEGORY_METAL;
            case "organic" -> CATEGORY_ORGANIC;
            default -> CATEGORY_PLASTIC;
        };
    }

    private static String catKeyFor(String category) {
        return switch (category) {
            case CATEGORY_METAL -> "me";
            case CATEGORY_ORGANIC -> "or";
            default -> "pl";
        };
    }

    private static int binNumberFor(String category) {
        return switch (category) {
            case CATEGORY_METAL -> 2;
            case CATEGORY_ORGANIC -> 3;
            default -> 1;
        };
    }

    private static String portFor(String category) {
        return switch (category) {
            case CATEGORY_ORGANIC -> "Cửa nạp #2";
            default -> "Cửa nạp #1";
        };
    }

    private static String defaultItemName(String category) {
        return switch (category) {
            case CATEGORY_METAL -> "Lon nước ngọt vừa nạp";
            case CATEGORY_ORGANIC -> "Vỏ chuối & thức ăn thừa vừa nạp";
            default -> "Chai nhựa nước giải khát vừa nạp";
        };
    }

    private static String defaultModelClass(String category) {
        return switch (category) {
            case CATEGORY_METAL -> "can_metal";
            case CATEGORY_ORGANIC -> "banana_peel";
            default -> "plastic_bottle";
        };
    }

    private static String defaultIcon(String category) {
        return switch (category) {
            case CATEGORY_METAL -> "can";
            case CATEGORY_ORGANIC -> "organic";
            default -> "bottle";
        };
    }

    private static int defaultBaseRate(String type) {
        return switch (type) {
            case "metal" -> DEFAULT_RATE_METAL;
            case "organic" -> DEFAULT_RATE_ORGANIC;
            default -> DEFAULT_RATE_PLASTIC;
        };
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private record RankInfo(
            String rankTitle,
            Integer nextRankPoints,
            String nextRankName,
            Integer progressPct) {
    }
}
