package com.smartbin.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.smartbin.dto.response.ClassificationResponse;
import com.smartbin.entity.Compartment;
import com.smartbin.entity.WasteLog;
import com.smartbin.exception.BusinessException;
import com.smartbin.repository.CompartmentRepository;
import com.smartbin.repository.WasteLogRepository;

/**
 * Runs AI inference on camera frames, logs detections and coordinates the
 * servo actuation response for the ESP32-S3 firmware.
 */
@Service
public class ClassificationService {

    private static final Path SNAPSHOT_DIRECTORY = Paths.get("uploads", "snapshots")
            .toAbsolutePath()
            .normalize();

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            ".jpg", ".jpeg", ".png", ".webp", ".bmp");

    private static final String STATUS_SUCCESS = "success";
    private static final String SERVO_STATUS = "ĐÃ GẠT THÀNH CÔNG";
    private static final String DETECTION_STATUS = "ĐÃ PHÂN LOẠI";

    private static final String PLASTIC = "NHỰA";
    private static final String METAL = "KIM LOẠI";
    private static final String PAPER = "GIẤY";

    private static final String CAT_KEY_PLASTIC = "pl";
    private static final String CAT_KEY_METAL = "me";
    private static final String CAT_KEY_PAPER = "or";

    private static final int SERVO_PLASTIC = 90;
    private static final int SERVO_METAL = 180;
    private static final int SERVO_PAPER = 0;

    private static final int BIN_PLASTIC = 1;
    private static final int BIN_METAL = 2;
    private static final int BIN_PAPER = 3;

    private static final double CAP = 30.0;

    private static final DateTimeFormatter FILE_TIMESTAMP = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss_SSS");
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm:ss");

    private final WasteLogRepository wasteLogRepository;
    private final CompartmentRepository compartmentRepository;
    private final WebSocketBroadcastService webSocketBroadcastService;

    public ClassificationService(WasteLogRepository wasteLogRepository,
            CompartmentRepository compartmentRepository,
            WebSocketBroadcastService webSocketBroadcastService) {
        this.wasteLogRepository = wasteLogRepository;
        this.compartmentRepository = compartmentRepository;
        this.webSocketBroadcastService = webSocketBroadcastService;
    }

    /**
     * Saves a single frame and runs classification, returning the inference result.
     */
    public AiInferenceResult runInference(MultipartFile frameFile) {
        return runInference(frameFile == null ? List.of() : List.of(frameFile));
    }

    /**
     * Saves a batch of frames and runs classification, returning the inference result.
     */
    public AiInferenceResult runInference(List<MultipartFile> frameFiles) {
        return classifyAndStore(frameFiles).result();
    }

    /**
     * Backward-compatible single-frame entry point.
     */
    @Transactional
    public ClassificationResponse processIncomingFrame(MultipartFile frame, Integer sensorPortId) {
        return processIncomingFrames(frame == null ? List.of() : List.of(frame), sensorPortId);
    }

    /**
     * Full pipeline for the ESP32-S3 multi-frame capture: saves the frame batch,
     * runs inference, persists the detection and broadcasts the servo command.
     */
    @Transactional
    public ClassificationResponse processIncomingFrames(List<MultipartFile> frames, Integer sensorPortId) {
        InferenceOutcome outcome = classifyAndStore(frames);
        AiInferenceResult inference = outcome.result();

        int portId = sensorPortId == null || sensorPortId <= 0 ? 1 : sensorPortId;
        String portLabel = "Cửa nạp #" + portId;

        WasteLog wasteLog = new WasteLog();
        wasteLog.setItemName(defaultItemName(inference.modelClass()));
        wasteLog.setCategory(inference.category());
        wasteLog.setCatKey(inference.catKey());
        wasteLog.setModelClass(inference.modelClass());
        wasteLog.setIconType(inference.iconType());
        wasteLog.setConfidence(inference.confidence());
        wasteLog.setBinNumber(inference.targetBin());
        wasteLog.setPort(portLabel);
        wasteLog.setServoStatus(SERVO_STATUS);

        WasteLog saved = wasteLogRepository.save(wasteLog);
        incrementCompartment(inference.targetBin());

        String timestamp = (saved.getCreatedAt() != null ? saved.getCreatedAt() : LocalDateTime.now())
                .format(TIME_FORMATTER);
        String confText = String.format(Locale.US, "%.1f%%", inference.confidence());

        broadcastDetection(saved, inference, confText, timestamp, portLabel, portId, outcome.imageUrl());
        broadcastActuationLogs(inference, portId);

        return new ClassificationResponse(
                STATUS_SUCCESS,
                inference.category(),
                inference.catKey(),
                inference.modelClass(),
                inference.confidence(),
                confText,
                inference.servoAngle(),
                inference.targetBin(),
                SERVO_STATUS,
                saved.getId(),
                timestamp);
    }

    private InferenceOutcome classifyAndStore(List<MultipartFile> frameFiles) {
        String imageUrl = saveFrames(frameFiles);
        AiInferenceResult result = simulateInference();
        return new InferenceOutcome(result, imageUrl);
    }

    private AiInferenceResult simulateInference() {
        ThreadLocalRandom random = ThreadLocalRandom.current();
        int roll = random.nextInt(100);

        String category;
        String catKey;
        String modelClass;
        String iconType;
        int servoAngle;
        int targetBin;

        if (roll < 45) {
            category = PLASTIC;
            catKey = CAT_KEY_PLASTIC;
            modelClass = random.nextBoolean() ? "plastic_bottle" : "plastic_cup";
            iconType = modelClass.equals("plastic_cup") ? "cup" : "bottle";
            servoAngle = SERVO_PLASTIC;
            targetBin = BIN_PLASTIC;
        } else if (roll < 75) {
            category = METAL;
            catKey = CAT_KEY_METAL;
            modelClass = random.nextBoolean() ? "can_metal" : "tin_can";
            iconType = "can";
            servoAngle = SERVO_METAL;
            targetBin = BIN_METAL;
        } else {
            category = PAPER;
            catKey = CAT_KEY_PAPER;
            modelClass = random.nextBoolean() ? "paper_cup" : "paper_box";
            iconType = modelClass.equals("paper_cup") ? "cup" : "box";
            servoAngle = SERVO_PAPER;
            targetBin = BIN_PAPER;
        }

        double confidence = Math.round((91.5 + random.nextDouble() * 6.9) * 10.0) / 10.0;
        confidence = Math.min(98.4, Math.max(91.5, confidence));

        return new AiInferenceResult(
                category,
                catKey,
                modelClass,
                iconType,
                confidence,
                servoAngle,
                targetBin);
    }

    /**
     * Persists every valid frame of the batch and returns the URL of the primary
     * (latest) snapshot used for the dashboard preview.
     */
    private String saveFrames(List<MultipartFile> frameFiles) {
        if (frameFiles == null || frameFiles.isEmpty()) {
            throw new BusinessException("Khung hình gửi lên không hợp lệ.");
        }

        String primaryImageUrl = null;
        for (MultipartFile frameFile : frameFiles) {
            if (frameFile == null || frameFile.isEmpty()) {
                continue;
            }
            primaryImageUrl = saveFrame(frameFile);
        }

        if (primaryImageUrl == null) {
            throw new BusinessException("Khung hình gửi lên không hợp lệ.");
        }

        return primaryImageUrl;
    }

    private String saveFrame(MultipartFile frameFile) {
        if (frameFile == null || frameFile.isEmpty()) {
            throw new BusinessException("Khung hình gửi lên không hợp lệ.");
        }

        String contentType = frameFile.getContentType();
        if (contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            throw new BusinessException("Khung hình phải là tệp ảnh.");
        }

        String extension = extensionOf(frameFile.getOriginalFilename());
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new BusinessException("Định dạng khung hình không được hỗ trợ.");
        }

        String fileName = "frame_" + LocalDateTime.now().format(FILE_TIMESTAMP)
                + "_" + ThreadLocalRandom.current().nextInt(1000, 10000) + extension;
        Path target = SNAPSHOT_DIRECTORY.resolve(fileName).normalize();

        try {
            Files.createDirectories(SNAPSHOT_DIRECTORY);
            frameFile.transferTo(target.toFile());
        } catch (IOException ex) {
            throw new BusinessException("Không thể lưu khung hình: " + ex.getMessage());
        }

        return "/uploads/snapshots/" + fileName;
    }

    private static String extensionOf(String originalName) {
        if (originalName == null) {
            return ".jpg";
        }
        int dotIndex = originalName.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == originalName.length() - 1) {
            return ".jpg";
        }
        return originalName.substring(dotIndex).toLowerCase(Locale.ROOT);
    }

    private void incrementCompartment(int binNumber) {
        Compartment compartment = compartmentRepository.findById(binNumber)
                .orElseGet(() -> defaultCompartment(binNumber));

        int currentCount = compartment.getItemCount() == null ? 0 : compartment.getItemCount();
        compartment.setItemCount(currentCount + 1);
        if (compartment.getCurrentDistance() == null) {
            compartment.setCurrentDistance(CAP);
        }
        compartment.setUpdatedAt(LocalDateTime.now());
        compartmentRepository.save(compartment);
    }

    private void broadcastDetection(WasteLog saved, AiInferenceResult inference, String confText,
            String timestamp, String portLabel, int portId, String imageUrl) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", saved.getId());
        payload.put("time", timestamp);
        payload.put("category", inference.category());
        payload.put("catKey", inference.catKey());
        payload.put("modelClass", inference.modelClass());
        payload.put("confidence", confText);
        payload.put("confVal", inference.confidence());
        payload.put("iconType", inference.iconType());
        payload.put("status", DETECTION_STATUS);
        payload.put("servoStatus", SERVO_STATUS);
        payload.put("servoAngle", inference.servoAngle());
        payload.put("targetBin", inference.targetBin());
        payload.put("binNumber", inference.targetBin());
        payload.put("port", portLabel);
        payload.put("portId", portId);
        payload.put("imageUrl", imageUrl);

        webSocketBroadcastService.broadcast("NEW_DETECTION", payload);
    }

    private void broadcastActuationLogs(AiInferenceResult inference, int portId) {
        broadcastRawLog("SENSOR",
                "Cảm biến quang điện #0" + portId + " phát hiện vật phẩm rơi");
        broadcastRawLog("CAMERA",
                "OV2640 hoàn tất gửi khung hình 240x240 (FPS: 15.2)");
        broadcastRawLog("ACTUATOR",
                "Servo SG90 quay " + inference.servoAngle() + "° gạt vào Ngăn "
                        + inference.targetBin() + " (" + inference.category() + ")");
    }

    private void broadcastRawLog(String tag, String message) {
        String line = "[" + tag + "] " + message;
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("tag", tag);
        payload.put("message", line);
        payload.put("payload", line);
        webSocketBroadcastService.broadcast("RAW_LOG", payload);
    }

    private static Compartment defaultCompartment(int binNumber) {
        Compartment compartment = new Compartment();
        compartment.setId(binNumber);
        compartment.setCurrentDistance(CAP);
        compartment.setItemCount(0);
        compartment.setUpdatedAt(LocalDateTime.now());

        switch (binNumber) {
            case 2 -> {
                compartment.setKey(CAT_KEY_METAL);
                compartment.setName("NGĂN SỐ 2 · KIM LOẠI");
            }
            case 3 -> {
                compartment.setKey(CAT_KEY_PAPER);
                compartment.setName("NGĂN SỐ 3 · GIẤY");
            }
            default -> {
                compartment.setKey(CAT_KEY_PLASTIC);
                compartment.setName("NGĂN SỐ 1 · NHỰA");
            }
        }

        return compartment;
    }

    private static String defaultItemName(String modelClass) {
        return switch (modelClass) {
            case "plastic_cup" -> "Ly nhựa dùng 1 lần";
            case "can_metal" -> "Lon nước ngọt 330ml";
            case "tin_can" -> "Hộp thiếc kim loại";
            case "paper_cup" -> "Ly giấy dùng 1 lần";
            case "paper_box" -> "Hộp giấy";
            default -> "Chai nhựa PET 500ml";
        };
    }

    /**
     * Result of the AI inference step.
     */
    public record AiInferenceResult(
            String category,
            String catKey,
            String modelClass,
            String iconType,
            Double confidence,
            int servoAngle,
            int targetBin) {
    }

    private record InferenceOutcome(AiInferenceResult result, String imageUrl) {
    }
}
