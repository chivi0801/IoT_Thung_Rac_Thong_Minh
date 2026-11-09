package com.smartbin.dto.response;

/**
 * Student profile with computed rank progress.
 */
public record StudentProfileResponse(
        String mssv,
        String name,
        String dept,
        String className,
        Integer points,
        String rank,
        Integer nextRankPoints,
        String nextRankName,
        Integer rankProgressPct,
        String avatarUrl) {
}
