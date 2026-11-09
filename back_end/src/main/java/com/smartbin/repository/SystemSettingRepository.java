package com.smartbin.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.smartbin.entity.SystemSetting;

/**
 * Key/value store for device configuration such as thresholds.
 */
@Repository
public interface SystemSettingRepository extends JpaRepository<SystemSetting, String> {

    /**
     * Reads an integer setting, falling back to {@code defaultValue} when the
     * key is missing, blank or not a valid integer.
     */
    default int getIntOrDefault(String key, int defaultValue) {
        return findById(key)
                .map(SystemSetting::getSettingValue)
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .map(value -> {
                    try {
                        return Integer.parseInt(value);
                    } catch (NumberFormatException ex) {
                        return defaultValue;
                    }
                })
                .orElse(defaultValue);
    }
}
