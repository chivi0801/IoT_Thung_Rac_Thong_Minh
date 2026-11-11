package com.smartbin.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Physical waste compartment of the Smart Waste Bin.
 *
 * <p>Each of the three compartments is identified by a fixed id (1, 2, 3)
 * and a short key ({@code pl}, {@code me}, {@code or}). The ultrasonic
 * distance is stored in centimetres and is converted to a fill level by the
 * service layer.</p>
 */
@Entity
@Table(name = "compartments")
public class Compartment {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private Integer id;

    @Column(name = "`key`", nullable = false, unique = true, length = 10)
    private String key;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "current_distance")
    private Double currentDistance;

    @Column(name = "item_count")
    private Integer itemCount;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Compartment() {
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getKey() {
        return key;
    }

    public void setKey(String key) {
        this.key = key;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Double getCurrentDistance() {
        return currentDistance;
    }

    public void setCurrentDistance(Double currentDistance) {
        this.currentDistance = currentDistance;
    }

    public Integer getItemCount() {
        return itemCount;
    }

    public void setItemCount(Integer itemCount) {
        this.itemCount = itemCount;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
