package com.smartbin.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.smartbin.entity.Redemption;

/**
 * Data access gateway for gift redemption transactions.
 */
@Repository
public interface RedemptionRepository extends JpaRepository<Redemption, Long> {

    List<Redemption> findAllByOrderByCreatedAtDesc();

    List<Redemption> findByStudentMssvOrderByCreatedAtDesc(String studentMssv);

    Optional<Redemption> findByVoucherCode(String voucherCode);
}
