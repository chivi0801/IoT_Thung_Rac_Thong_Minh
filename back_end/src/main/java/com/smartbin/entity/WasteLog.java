package com.smartbin.entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

/**
 * Classification history entry for the Smart Waste Bin system.
 *
 * <p>Each row represents one waste item that was detected by the AI vision
 * model and, optionally, routed into one of the three physical compartments.</p>
 */
@Entity
@Table(name = "waste_logs", indexes = {
        @Index(name = "idx_waste_logs_created_at", columnList = "created_at"),
        @Index(name = "idx_waste_logs_category", columnList = "category"),
        @Index(name = "idx_waste_logs_cat_key", columnList = "cat_key")
})
public class WasteLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "item_name", nullable = false, length = 255)
    private String itemName;

    @Column(name = "category", length = 50)
    private String category;

    @Column(name = "cat_key", length = 10)
    private String catKey;

    @Column(name = "confidence")
    private Double confidence;

    @Column(name = "model_class", length = 100)
    private String modelClass;

    @Column(name = "icon_type", length = 20)
    private String iconType;

    @Column(name = "bin_number", nullable = false)
    private Integer binNumber;

    @Column(name = "port", length = 50)
    private String port;

    @Column(name = "servo_status", length = 50)
    private String servoStatus;

    @Column(name = "student_mssv", length = 50)
    private String studentMssv;

    @Column(name = "points_awarded")
    private Integer pointsAwarded;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public WasteLog() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getItemName() {
        return itemName;
    }

    public void setItemName(String itemName) {
        this.itemName = itemName;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getCatKey() {
        return catKey;
    }

    public void setCatKey(String catKey) {
        this.catKey = catKey;
    }

    public Double getConfidence() {
        return confidence;
    }

    public void setConfidence(Double confidence) {
        this.confidence = confidence;
    }

    public String getModelClass() {
        return modelClass;
    }

    public void setModelClass(String modelClass) {
        this.modelClass = modelClass;
    }

    public String getIconType() {
        return iconType;
    }

    public void setIconType(String iconType) {
        this.iconType = iconType;
    }

    public Integer getBinNumber() {
        return binNumber;
    }

    public void setBinNumber(Integer binNumber) {
        this.binNumber = binNumber;
    }

    public String getPort() {
        return port;
    }

    public void setPort(String port) {
        this.port = port;
    }

    public String getServoStatus() {
        return servoStatus;
    }

    public void setServoStatus(String servoStatus) {
        this.servoStatus = servoStatus;
    }

    public String getStudentMssv() {
        return studentMssv;
    }

    public void setStudentMssv(String studentMssv) {
        this.studentMssv = studentMssv;
    }

    public Integer getPointsAwarded() {
        return pointsAwarded;
    }

    public void setPointsAwarded(Integer pointsAwarded) {
        this.pointsAwarded = pointsAwarded;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
