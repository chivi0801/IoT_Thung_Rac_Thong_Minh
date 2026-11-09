package com.smartbin.controller;

import java.util.List;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.smartbin.dto.request.ClaimRewardRequest;
import com.smartbin.dto.request.RedeemGiftRequest;
import com.smartbin.dto.response.ApiResponse;
import com.smartbin.dto.response.StudentHistoryResponse;
import com.smartbin.dto.response.StudentProfileResponse;
import com.smartbin.dto.response.VoucherResponse;
import com.smartbin.service.StudentService;

import jakarta.validation.Valid;

/**
 * REST endpoints consumed by {@code tich-diem.html} / {@code tich-diem.js}.
 */
@RestController
@RequestMapping("/api/v1/students")
public class StudentController {

    private final StudentService studentService;

    public StudentController(StudentService studentService) {
        this.studentService = studentService;
    }

    @PostMapping(value = "/ocr-scan", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<StudentProfileResponse> scanStudentCard(
            @RequestParam("file") MultipartFile file) {
        return ApiResponse.success(
                studentService.scanStudentCard(file),
                "Nhận diện thẻ sinh viên thành công");
    }

    @GetMapping("/{mssv}")
    public ApiResponse<StudentProfileResponse> getStudentProfile(@PathVariable String mssv) {
        return ApiResponse.success(
                studentService.getStudentProfile(mssv),
                "Lấy thông tin sinh viên thành công");
    }

    @PostMapping("/claim-reward")
    public ApiResponse<StudentProfileResponse> claimReward(
            @Valid @RequestBody ClaimRewardRequest request) {
        return ApiResponse.success(
                studentService.claimReward(request),
                "Chúc mừng bạn đã tích thêm điểm xanh!");
    }

    @PostMapping("/redeem")
    public ApiResponse<VoucherResponse> redeemGift(
            @Valid @RequestBody RedeemGiftRequest request) {
        VoucherResponse voucher = studentService.redeemGift(request);
        return ApiResponse.success(voucher, voucher.message());
    }

    @GetMapping("/{mssv}/history")
    public ApiResponse<List<StudentHistoryResponse>> getStudentHistory(
            @PathVariable String mssv) {
        return ApiResponse.success(
                studentService.getStudentHistory(mssv),
                "Lấy lịch sử tích điểm thành công");
    }
}
