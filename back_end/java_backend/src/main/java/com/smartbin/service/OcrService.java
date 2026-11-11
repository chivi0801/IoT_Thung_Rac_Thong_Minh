package com.smartbin.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.smartbin.exception.BusinessException;

/**
 * Extracts student identity data from an uploaded student card image.
 *
 * <p>The pipeline saves the uploaded file, then attempts a lightweight
 * filename/text heuristic for an 8-digit MSSV. When no reliable data can be
 * extracted it falls back to demo profiles that mirror {@code sampleProfiles}
 * in {@code tich-diem.js}. The class is structured so a real OCR engine can be
 * plugged in later without changing callers.</p>
 */
@Service
public class OcrService {

    private static final Path STUDENT_CARD_DIRECTORY = Paths.get("uploads", "student_cards")
            .toAbsolutePath()
            .normalize();

    private static final Pattern MSSV_PATTERN = Pattern.compile("(?<!\\d)\\d{8}(?!\\d)");

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif");

    private static final List<DemoProfile> DEMO_PROFILES = List.of(
            new DemoProfile("21120489", "Nguyễn Văn An",
                    "Khoa Công nghệ Thông tin", "K45-CNTT1"),
            new DemoProfile("22118742", "Trần Thị Mai Hương",
                    "Khoa Môi trường & Tài nguyên", "K46-MT02"),
            new DemoProfile("20119631", "Lê Hoàng Long",
                    "Khoa Điện - Điện tử", "K44-DTVT"));

    /**
     * Saves the card image and returns the extracted student information.
     */
    public OcrResult extractStudentInfo(MultipartFile file) {
        validateFile(file);
        String storedFileName = saveFile(file);
        String avatarUrl = "/uploads/student_cards/" + storedFileName;

        String originalName = file.getOriginalFilename();
        String mssv = extractMssv(originalName);
        DemoProfile profile = resolveProfile(mssv, originalName, file.getSize());

        String resolvedMssv = mssv != null ? mssv : profile.mssv();
        return new OcrResult(
                resolvedMssv,
                profile.name(),
                profile.dept(),
                profile.className(),
                avatarUrl);
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("Vui lòng chọn ảnh thẻ sinh viên để quét.");
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            throw new BusinessException("Tệp tải lên phải là hình ảnh thẻ sinh viên.");
        }

        String extension = extensionOf(file.getOriginalFilename());
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new BusinessException("Định dạng ảnh không được hỗ trợ. Vui lòng dùng JPG, PNG hoặc WEBP.");
        }
    }

    private String saveFile(MultipartFile file) {
        String extension = extensionOf(file.getOriginalFilename());
        String storedFileName = UUID.randomUUID().toString().replace("-", "") + extension;
        Path target = STUDENT_CARD_DIRECTORY.resolve(storedFileName).normalize();

        try {
            Files.createDirectories(STUDENT_CARD_DIRECTORY);
            file.transferTo(target.toFile());
        } catch (IOException ex) {
            throw new BusinessException("Không thể lưu ảnh thẻ sinh viên: " + ex.getMessage());
        }

        return storedFileName;
    }

    private static String extensionOf(String originalName) {
        if (originalName == null) {
            return "";
        }
        int dotIndex = originalName.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == originalName.length() - 1) {
            return "";
        }
        return originalName.substring(dotIndex).toLowerCase(Locale.ROOT);
    }

    private static String extractMssv(String originalName) {
        if (originalName == null || originalName.isBlank()) {
            return null;
        }
        Matcher matcher = MSSV_PATTERN.matcher(originalName);
        return matcher.find() ? matcher.group() : null;
    }

    private static DemoProfile resolveProfile(String mssv, String originalName, long fileSize) {
        if (mssv != null) {
            for (DemoProfile profile : DEMO_PROFILES) {
                if (profile.mssv().equals(mssv)) {
                    return profile;
                }
            }
        }

        int index = Math.floorMod(Objects.hash(originalName, fileSize), DEMO_PROFILES.size());
        return DEMO_PROFILES.get(index);
    }

    /**
     * Extracted student information returned by the OCR pipeline.
     */
    public record OcrResult(
            String mssv,
            String name,
            String dept,
            String className,
            String avatarUrl) {
    }

    private record DemoProfile(
            String mssv,
            String name,
            String dept,
            String className) {
    }
}
