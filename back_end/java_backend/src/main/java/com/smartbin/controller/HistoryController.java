package com.smartbin.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.smartbin.dto.response.ApiResponse;
import com.smartbin.dto.response.HistoryPageResponse;
import com.smartbin.dto.response.HistorySnapshotResponse;
import com.smartbin.service.HistoryService;

/**
 * REST endpoints consumed by {@code lich-su.html} / {@code lich-su.js}.
 */
@RestController
@RequestMapping("/api/v1/history")
public class HistoryController {

    private final HistoryService historyService;

    public HistoryController(HistoryService historyService) {
        this.historyService = historyService;
    }

    @GetMapping
    public ApiResponse<HistoryPageResponse> getHistory(
            @RequestParam(name = "page", defaultValue = "1") int page,
            @RequestParam(name = "size", defaultValue = "6") int size,
            @RequestParam(name = "category", defaultValue = "ALL") String category) {
        return ApiResponse.success(
                historyService.getHistory(page, size, category),
                "Lấy lịch sử phân loại thành công");
    }

    @GetMapping("/{id}/snapshot")
    public ApiResponse<HistorySnapshotResponse> getSnapshotDetails(@PathVariable("id") Long id) {
        return ApiResponse.success(
                historyService.getSnapshotDetails(id),
                "Lấy chi tiết ảnh nhận diện thành công");
    }
}
