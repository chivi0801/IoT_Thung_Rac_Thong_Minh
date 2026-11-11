package com.smartbin.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.smartbin.dto.request.GiftRequest;
import com.smartbin.dto.request.RatesConfigRequest;
import com.smartbin.dto.response.ApiResponse;
import com.smartbin.dto.response.GiftResponse;
import com.smartbin.dto.response.RatesConfigResponse;
import com.smartbin.dto.response.RedemptionResponse;
import com.smartbin.service.RewardService;

import jakarta.validation.Valid;

/**
 * REST endpoints consumed by {@code doi-thuong.html} / {@code doi-thuong.js}.
 */
@RestController
@RequestMapping("/api/v1/rewards")
public class RewardController {

    private final RewardService rewardService;

    public RewardController(RewardService rewardService) {
        this.rewardService = rewardService;
    }

    @GetMapping("/rates")
    public ApiResponse<RatesConfigResponse> getRatesConfig() {
        return ApiResponse.success(
                rewardService.getRatesConfig(),
                "Lấy cấu hình điểm quy đổi thành công");
    }

    @PutMapping("/rates")
    public ApiResponse<RatesConfigResponse> updateRatesConfig(
            @Valid @RequestBody RatesConfigRequest request) {
        return ApiResponse.success(
                rewardService.updateRatesConfig(request),
                "Đã lưu cấu hình điểm quy đổi thành công!");
    }

    @GetMapping("/gifts")
    public ApiResponse<List<GiftResponse>> getAllGifts() {
        return ApiResponse.success(
                rewardService.getAllGifts(),
                "Lấy danh sách phần quà thành công");
    }

    @PostMapping("/gifts")
    public ResponseEntity<ApiResponse<GiftResponse>> createGift(
            @Valid @RequestBody GiftRequest request) {
        GiftResponse created = rewardService.createGift(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(created, "Đã thêm phần quà thành công!"));
    }

    @PutMapping("/gifts/{id}")
    public ApiResponse<GiftResponse> updateGift(
            @PathVariable Long id,
            @Valid @RequestBody GiftRequest request) {
        return ApiResponse.success(
                rewardService.updateGift(id, request),
                "Đã cập nhật phần quà thành công!");
    }

    @PatchMapping("/gifts/{id}/toggle")
    public ApiResponse<GiftResponse> toggleGiftStatus(@PathVariable Long id) {
        return ApiResponse.success(
                rewardService.toggleGiftStatus(id),
                "Đã cập nhật trạng thái phần quà thành công!");
    }

    @DeleteMapping("/gifts/{id}")
    public ApiResponse<Void> deleteGift(@PathVariable Long id) {
        rewardService.deleteGift(id);
        return ApiResponse.<Void>success(null, "Đã xóa phần quà thành công.");
    }

    @GetMapping("/redemptions")
    public ApiResponse<List<RedemptionResponse>> getAllRedemptions() {
        return ApiResponse.success(
                rewardService.getAllRedemptions(),
                "Lấy lịch sử đổi quà thành công");
    }
}
