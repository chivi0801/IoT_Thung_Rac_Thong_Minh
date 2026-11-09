package com.smartbin.init;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.smartbin.entity.Compartment;
import com.smartbin.entity.Gift;
import com.smartbin.entity.Redemption;
import com.smartbin.entity.Student;
import com.smartbin.entity.SystemSetting;
import com.smartbin.entity.WasteLog;
import com.smartbin.repository.CompartmentRepository;
import com.smartbin.repository.GiftRepository;
import com.smartbin.repository.RedemptionRepository;
import com.smartbin.repository.StudentRepository;
import com.smartbin.repository.SystemSettingRepository;
import com.smartbin.repository.WasteLogRepository;

/**
 * Seeds the demo dataset used by the dashboard, device, reward and student
 * pages. Every step is idempotent so the application can run safely with
 * {@code ddl-auto=update} after the initial schema rebuild.
 */
@Component
@Order(1)
public class DataInitializer implements CommandLineRunner {

    private static final String STATUS_ACTIVE = "active";
    private static final String STATUS_PENDING = "pending";
    private static final String STATUS_CLAIMED = "claimed";

    private final SystemSettingRepository systemSettingRepository;
    private final CompartmentRepository compartmentRepository;
    private final GiftRepository giftRepository;
    private final StudentRepository studentRepository;
    private final WasteLogRepository wasteLogRepository;
    private final RedemptionRepository redemptionRepository;

    public DataInitializer(SystemSettingRepository systemSettingRepository,
            CompartmentRepository compartmentRepository,
            GiftRepository giftRepository,
            StudentRepository studentRepository,
            WasteLogRepository wasteLogRepository,
            RedemptionRepository redemptionRepository) {
        this.systemSettingRepository = systemSettingRepository;
        this.compartmentRepository = compartmentRepository;
        this.giftRepository = giftRepository;
        this.studentRepository = studentRepository;
        this.wasteLogRepository = wasteLogRepository;
        this.redemptionRepository = redemptionRepository;
    }

    @Override
    @Transactional
    public void run(String... args) {
        seedSystemSettings();
        seedCompartments();
        seedGifts();
        seedStudents();
        seedWasteLogs();
        seedRedemptions();
    }

    private void seedSystemSettings() {
        seedSetting("rate_plastic", "10", "Điểm quy đổi cho mỗi vật thể nhựa");
        seedSetting("rate_metal", "15", "Điểm quy đổi cho mỗi vật thể kim loại");
        seedSetting("rate_organic", "5", "Điểm quy đổi cho mỗi vật thể hữu cơ");
        seedSetting("event_multiplier", "1.0", "Hệ số nhân điểm trong sự kiện");
        seedSetting("threshold_full", "80", "Ngưỡng cảnh báo đầy (%)");
        seedSetting("threshold_conf", "60", "Độ tin cậy tối thiểu của AI (%)");
    }

    private void seedSetting(String key, String value, String description) {
        if (systemSettingRepository.existsById(key)) {
            return;
        }

        SystemSetting setting = new SystemSetting();
        setting.setSettingKey(key);
        setting.setSettingValue(value);
        setting.setDescription(description);
        setting.setUpdatedAt(LocalDateTime.now());
        systemSettingRepository.save(setting);
    }

    private void seedCompartments() {
        seedCompartment(1, "pl", "NGĂN SỐ 1 · NHỰA", 5.6, 38);
        seedCompartment(2, "me", "NGĂN SỐ 2 · KIM LOẠI", 17.4, 21);
        seedCompartment(3, "or", "NGĂN SỐ 3 · HỮU CƠ", 11.1, 27);
    }

    private void seedCompartment(int id, String key, String name,
            double distance, int itemCount) {
        if (compartmentRepository.existsById(id)) {
            return;
        }

        Compartment compartment = new Compartment();
        compartment.setId(id);
        compartment.setKey(key);
        compartment.setName(name);
        compartment.setCurrentDistance(distance);
        compartment.setItemCount(itemCount);
        compartment.setUpdatedAt(LocalDateTime.now());
        compartmentRepository.save(compartment);
    }

    private void seedGifts() {
        Gift voucher = ensureGift("Voucher Căn tin 20.000đ", "🎁", 50, 85,
                "Áp dụng cho mọi món ăn & đồ uống tại Căn tin trường");
        ensureGift("Bình giữ nhiệt Eco Green 500ml", "🍶", 200, 18,
                "Inox 304 giữ nhiệt 12h, in logo Thùng Rác Thông Minh");
        ensureGift("Túi vải Canvas bảo vệ môi trường", "👜", 80, 42,
                "Vải canvas sợi tự nhiên tái sử dụng nhiều lần");
        ensureGift("+5 Điểm rèn luyện học kỳ", "⭐", 150, 999,
                "Cộng trực tiếp mục Hoạt động Tình nguyện vì Môi trường");
        ensureGift("Hộp bút tre tái sinh (3 cây)", "✏️", 30, 120,
                "Vỏ tre tự nhiên phân hủy sinh học, mực gel êm ái");

        if (voucher.getId() == null) {
            throw new IllegalStateException("Failed to seed the default voucher gift");
        }
    }

    private Gift ensureGift(String name, String icon, int points, int stock, String description) {
        return giftRepository.findAll().stream()
                .filter(gift -> name.equals(gift.getName()))
                .findFirst()
                .orElseGet(() -> {
                    Gift gift = new Gift();
                    gift.setName(name);
                    gift.setIcon(icon);
                    gift.setPoints(points);
                    gift.setStock(stock);
                    gift.setDescription(description);
                    gift.setStatus(STATUS_ACTIVE);
                    return giftRepository.save(gift);
                });
    }

    private void seedStudents() {
        ensureStudent("21120489", "Nguyễn Văn An",
                "Khoa Công nghệ Thông tin", "K45-CNTT1",
                135, "Chiến Binh Xanh (Cấp 3)");
        ensureStudent("22118742", "Trần Thị Mai Hương",
                "Khoa Môi trường & Tài nguyên", "K46-MT02",
                90, "Hạt Giống Xanh (Cấp 2)");
        ensureStudent("20119631", "Lê Hoàng Long",
                "Khoa Điện - Điện tử", "K44-DTVT",
                210, "Đại Sứ Môi Trường (Cấp 4)");
    }

    private void ensureStudent(String mssv, String fullName, String faculty,
            String className, int points, String rankTitle) {
        if (studentRepository.existsByMssv(mssv)) {
            return;
        }

        Student student = new Student();
        student.setMssv(mssv);
        student.setFullName(fullName);
        student.setFaculty(faculty);
        student.setClassName(className);
        student.setTotalPoints(points);
        student.setRankTitle(rankTitle);
        studentRepository.save(student);
    }

    private void seedWasteLogs() {
        if (wasteLogRepository.count() > 0) {
            return;
        }

        wasteLogRepository.save(buildWasteLog(
                "Chai nhựa PET 500ml", "NHỰA", "pl", 96.4,
                "plastic_bottle", "bottle", 1, "Cửa nạp #1", "Thành công",
                "21120489", 10));
        wasteLogRepository.save(buildWasteLog(
                "Lon nước ngọt 330ml", "KIM LOẠI", "me", 94.2,
                "can_metal", "can", 2, "Cửa nạp #1", "Thành công",
                "22118742", 15));
        wasteLogRepository.save(buildWasteLog(
                "Vỏ chuối", "HỮU CƠ", "or", 98.1,
                "banana_peel", "organic", 3, "Cửa nạp #2", "Thành công",
                "20119631", 5));
        wasteLogRepository.save(buildWasteLog(
                "Ly nhựa dùng 1 lần", "NHỰA", "pl", 91.5,
                "plastic_cup", "cup", 1, "Cửa nạp #1", "Thành công",
                "21120489", 10));
    }

    private static WasteLog buildWasteLog(String itemName, String category, String catKey,
            double confidence, String modelClass, String iconType, int binNumber,
            String port, String servoStatus, String studentMssv, int pointsAwarded) {
        WasteLog log = new WasteLog();
        log.setItemName(itemName);
        log.setCategory(category);
        log.setCatKey(catKey);
        log.setConfidence(confidence);
        log.setModelClass(modelClass);
        log.setIconType(iconType);
        log.setBinNumber(binNumber);
        log.setPort(port);
        log.setServoStatus(servoStatus);
        log.setStudentMssv(studentMssv);
        log.setPointsAwarded(pointsAwarded);
        return log;
    }

    private void seedRedemptions() {
        seedRedemption("RDM-8492", "21120489", "Nguyễn Văn An",
                "Voucher Căn tin 20.000đ", 50, STATUS_CLAIMED);
        seedRedemption("RDM-8490", "22118742", "Trần Thị Mai Hương",
                "Túi vải Canvas bảo vệ môi trường", 80, STATUS_PENDING);
        seedRedemption("RDM-8475", "20119631", "Lê Hoàng Long",
                "+5 Điểm rèn luyện học kỳ", 150, STATUS_CLAIMED);
    }

    private void seedRedemption(String code, String studentMssv, String studentName,
            String giftName, int points, String status) {
        if (redemptionRepository.findByVoucherCode(code).isPresent()) {
            return;
        }

        List<Gift> gifts = giftRepository.findAll();
        Gift gift = gifts.stream()
                .filter(item -> giftName.equals(item.getName()))
                .findFirst()
                .orElse(null);

        Redemption redemption = new Redemption();
        redemption.setVoucherCode(code);
        redemption.setStudentMssv(studentMssv);
        redemption.setStudentName(studentName);
        redemption.setGiftId(gift == null ? null : gift.getId());
        redemption.setGiftName(giftName);
        redemption.setPointsSpent(points);
        redemption.setStatus(status);
        if (STATUS_CLAIMED.equals(status)) {
            redemption.setClaimedAt(LocalDateTime.now().minusHours(2));
        }
        redemptionRepository.save(redemption);
    }
}
